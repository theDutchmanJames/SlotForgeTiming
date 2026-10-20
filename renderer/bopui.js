// Balance of Power on screen: the settings page (Race Setup > Balance of Power) and the controls for the lanes (race screen and Race Director page).
// The numbers are in bop.js, what a car gets is in engine.js; this file only draws and passes on what is pressed.
// Settings kept: bopMode, bopWho, bopGrade, bopPercent, bopScale, bopFull, bopMeasure, bopWindow, bopMinLaps, bopApply, bopRemove, bopLanes, bopUse, bopRate, bopTank.

// ---- the settings page ----
async function renderBopSettings(box) {
  const S = Bop.settingsOf(state.settings), K = Bop.KEYS;
  const opts = (list, v) => list.map(([k, t]) => `<option value="${esc(k)}"${k === v ? ' selected' : ''}>${esc(t)}</option>`).join('');
  const n3 = x => String(Math.round(x * 1000) / 1000);
  const check = (id, on, label, hint) => `<div class="field"><label class="inline"><input type="checkbox" id="${id}"${on ? ' checked' : ''}> ${esc(label)}</label>${hint ? `<span class="muted hint">${esc(hint)}</span>` : ''}</div>`;
  const auto = S.mode !== 'manual';
  box.innerHTML = `<section class="card bopset">
      <h3>Who decides</h3>
      <div class="field"><label for="bop-mode">Mode</label><select id="bop-mode">${opts(Bop.MODES, S.mode)}</select>
        <span class="muted hint">Manual: the Race Director presses Hinder or Help for a lane. Suggest: the app watches the lap times and proposes, the Race Director accepts. Automatic: the app applies and removes it by itself (the Race Director can still overrule a lane).</span></div>
      <div class="field"><label for="bop-who">Who gets it</label><select id="bop-who">${opts(Bop.WHO, S.who)}</select></div>
      <div class="field"><label for="bop-grade">How many cars</label><select id="bop-grade">${opts(Bop.GRADE, S.grade)}</select>
        <span class="muted hint">Graded: the fastest car is hindered by the whole percentage, a car close to the middle hardly at all, and the slowest car is helped by the whole percentage.</span></div>
    </section>
    <section class="card bopset">
      <h3>How much</h3>
      <div class="field"><label for="bop-percent">Percentage: <strong id="bop-percent-n">${S.percent}%</strong></label><input type="range" id="bop-percent" min="1" max="${Bop.MAXP}" step="1" value="${S.percent}" aria-label="Balance of Power percentage"></div>
      <div class="field"><label for="bop-scale">Strength</label><select id="bop-scale">${opts(Bop.SCALE, S.scale)}</select></div>
      ${S.scale === 'scaled' ? `<div class="field"><label for="bop-full">Full percentage at a difference of (seconds per lap)</label><input id="bop-full" type="number" min="0.1" max="600" step="0.1" value="${n3(S.full)}"><span class="muted hint">At half of that difference the car gets half of the percentage.</span></div>` : ''}
      <h4>What changes on the car</h4>
      ${check('bop-use', S.use, 'The fuel a lap uses', 'Hindered: more fuel per lap. Helped: less. The car has to pit sooner, or drive slower.')}
      ${check('bop-rate', S.rate, 'How fast it refuels in the pits', 'Hindered: slower stops. Helped: quicker stops.')}
      ${check('bop-tank', S.tank, 'The size of the tank', 'Hindered: a smaller tank. Helped: a bigger one. Fuel in the tank that no longer fits is lost.')}
      <p class="muted" id="bop-example"></p>
    </section>
    <section class="card bopset">
      <h3>Suggest and Automatic${auto ? '' : ' <span class="muted">(not used in Manual mode)</span>'}</h3>
      <div class="field"><label for="bop-measure">The pace of a car is its</label><select id="bop-measure">${opts(Bop.MEASURE, S.measure)}</select></div>
      <div class="inline">
        <div class="field"><label for="bop-window">Last laps that count</label><input id="bop-window" type="number" min="3" max="50" step="1" value="${S.window}"></div>
        <div class="field"><label for="bop-minlaps">Laps needed before it can apply</label><input id="bop-minlaps" type="number" min="1" max="${S.window}" step="1" value="${S.minLaps}"></div>
      </div>
      <div class="inline">
        <div class="field"><label for="bop-apply">Apply at a difference of (seconds per lap)</label><input id="bop-apply" type="number" min="0.01" max="600" step="0.05" value="${n3(S.apply)}"></div>
        <div class="field"><label for="bop-remove">Remove below a difference of (seconds)</label><input id="bop-remove" type="number" min="0" max="${n3(S.apply)}" step="0.05" value="${n3(S.remove)}"></div>
      </div>
      <p class="muted hint">The difference is the one between the pace of the fastest and the slowest car on the track. It comes on at the first number and goes off at the second, a little lower, so it does not flicker on and off. Laps with a pit stop, invalid laps and laps taken out do not count.</p>
      ${check('bop-lanes', S.lanes, 'Correct for the length of the lanes', 'A car on a longer lane is not held back for being on it. Needs the lane lengths of the track (Database > Tracks).')}
    </section>
    <div class="row"><button class="btn" id="bop-reset">Back to the standard settings</button> <span class="muted" id="bop-msg" role="status"></span></div>
    <p class="muted">To use these: turn Balance of Power on in a race setup (Race Setups > Balance of Power). It needs a Fuel System, because it works through the fuel rules. It only changes the fuel use, the refuelling and the tank of a car, so it fine-tunes: a car that is several seconds a lap faster will not be caught by it alone. Where a long race or short tank makes the cars pit, it bites the most.</p>`;
  const el = id => document.getElementById(id);
  const example = P => { // what the percentage does to a car, with the effects that are on
    const t = Bop.effectText(-P, S);
    el('bop-example').textContent = t ? `At ${P}%, a hindered car ${t}. A helped car gets the opposite.` : 'Every effect is switched off, so nothing would change on a car.';
  };
  example(S.percent);
  const save = async patch => { // (the page is drawn again with the new settings; the field you were in gets the focus back, so the arrow keys on the slider keep working)
    const id = document.activeElement && document.activeElement.id;
    state.settings = await api.setSettings(patch); await renderBopSettings(box);
    const again = id && document.getElementById(id); if (again && again.focus) again.focus();
  };
  const select = (id, key) => { el(id).onchange = ev => save({ [key]: ev.target.value }); };
  const cleaned = (key, short, v) => Bop.settingsOf({ ...state.settings, [key]: v })[short]; // (cleaned with the other settings: the laps needed can not be more than the laps that count)
  const number = (id, key, short) => { el(id).onchange = ev => save({ [key]: cleaned(key, short, ev.target.value) }); };
  select('bop-mode', K.mode); select('bop-who', K.who); select('bop-grade', K.grade); select('bop-scale', K.scale); select('bop-measure', K.measure);
  el('bop-percent').oninput = ev => { el('bop-percent-n').textContent = ev.target.value + '%'; example(Number(ev.target.value) || S.percent); };
  el('bop-percent').onchange = ev => save({ [K.percent]: cleaned(K.percent, 'percent', ev.target.value) });
  if (el('bop-full')) number('bop-full', K.full, 'full');
  ['use', 'rate', 'tank'].forEach(k => { el('bop-' + k).onchange = ev => save({ [K[k]]: !!ev.target.checked }); });
  el('bop-lanes').onchange = ev => save({ [K.lanes]: !!ev.target.checked });
  number('bop-window', K.window, 'window'); number('bop-minlaps', K.minLaps, 'minLaps');
  el('bop-apply').onchange = ev => { // (when the "remove" difference is still half of this one, it stays half of it)
    const apply = cleaned(K.apply, 'apply', ev.target.value), follows = Math.abs(S.remove - S.apply / 2) < 1e-9;
    save({ [K.apply]: apply, ...(follows ? { [K.remove]: apply / 2 } : {}) });
  };
  number('bop-remove', K.remove, 'remove');
  el('bop-reset').onclick = async () => { state.settings = await api.setSettings(Bop.standardSettings()); await renderBopSettings(box); const m = el('bop-msg'); if (m) m.textContent = 'Back to the standard settings.'; };
}

// ---- the lane controls ----
// o: { eng (the engine, or a function that gives the current one: the race window's, or the one a viewer follows), lanes: [lane numbers (0...)], phase() (the phase of the race screen),
//      send(lane, how) (how: hinder | help | off | auto | accept) }
// Built once; update() only changes what changed, so a button never moves under a finger.
const BopPanel = (() => {
  const BUTTONS = ['hinder', 'help', 'off', 'auto', 'accept'];
  function build(box, o) {
    const getE = () => (typeof o.eng === 'function' ? o.eng() : o.eng);
    box.hidden = false;
    box.innerHTML = `<div class="bophead"><strong>Balance of Power</strong><span class="muted" data-bop="info"></span></div>
      <div class="wrap"><table class="fields boptable"><thead><tr><th>Lane</th><th>Driver</th><th>Now</th><th>Proposed</th><th>Set</th></tr></thead><tbody>${o.lanes.map(l => `<tr data-lane="${l}">
        <td><strong>${l + 1}</strong></td><td data-bop="who"></td><td><span class="bopchip" data-bop="now">BoP off</span> <span class="muted" data-bop="held"></span></td><td data-bop="to"></td>
        <td><div class="tkbtns">${BUTTONS.map(b => `<button class="btn" type="button" data-bop="${b}" aria-label="${b[0].toUpperCase() + b.slice(1)} lane ${l + 1}">${b[0].toUpperCase() + b.slice(1)}</button>`).join('')}</div></td></tr>`).join('')}</tbody></table></div>`;
    const row = l => box.querySelector(`tr[data-lane="${l}"]`);
    box.onclick = ev => {
      const b = ev.target.closest && ev.target.closest('button[data-bop]'); if (!b || b.disabled) return;
      if (b.blur) b.blur();
      const tr = b.closest('tr'); if (tr) o.send(Number(tr.dataset.lane), b.dataset.bop);
    };
    const set = (el, text) => { if (el && el.textContent !== text) el.textContent = text; };
    function update() {
      const v = Bop.view(getE(), o.lanes, o.phase());
      box.hidden = !v.on; if (!v.on) return;
      set(box.querySelector('[data-bop="info"]'), v.info);
      v.rows.forEach(r => {
        const tr = row(r.lane); if (!tr) return;
        tr.hidden = !r.show; if (!r.show) return;
        const q = s => tr.querySelector(`[data-bop="${s}"]`);
        set(q('who'), r.who); set(q('to'), r.to); set(q('held'), r.held ? 'held' : '');
        const chip = q('now'); set(chip, r.now);
        const cls = 'bopchip bop-' + r.kind; if (chip.className !== cls) chip.className = cls;
        BUTTONS.forEach(b => {
          const x = r[b], bt = q(b); if (!bt) return;
          bt.hidden = x.show === false; bt.disabled = x.disabled; set(bt, x.text);
          const pressed = x.on ? 'true' : 'false'; if (bt.getAttribute && bt.getAttribute('aria-pressed') !== pressed && bt.setAttribute) bt.setAttribute('aria-pressed', pressed);
        });
      });
    }
    return { update };
  }
  return { build };
})();
