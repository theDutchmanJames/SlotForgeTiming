// The Damage System on screen: the damage panel (race screen and Race Director page). What it shows is worked out in damage.js (Damage.view);
// this file only draws it and passes on what is pressed. Built once; update() only changes what changed, so a button under a finger is not drawn again.
// o: { eng (the engine, or a function that gives the current one: the race window's, or the one a viewer follows), lanes: [lane numbers (0...)], incidents: [{ name, points }],
//      phase() (the phase of the race screen), now() (the time of the screen, as performance.now()), send(lane, n) (n: the damage points to give, negative to take back) }
const DamagePanel = (() => {
  const esc = x => String(x).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  function build(box, o) {
    const getE = () => (typeof o.eng === 'function' ? o.eng() : o.eng), inc = Array.isArray(o.incidents) ? o.incidents : [];
    box.hidden = false;
    box.innerHTML = `<div class="bophead"><strong>Damage</strong><span class="muted" data-dm="info"></span></div>
      <div class="wrap"><table class="fields dmtable"><thead><tr><th>Lane</th><th>Car</th><th>Points</th><th>Damage</th><th>What it asks</th><th>Give damage</th></tr></thead><tbody>${o.lanes.map(l => `<tr data-lane="${l}">
        <td><strong>${l + 1}</strong></td><td data-dm="who"></td><td class="num" data-dm="points"></td><td><span class="dmchip dm-ok" data-dm="chip"></span></td><td class="muted" data-dm="note"></td>
        <td class="actions">${inc.map((x, k) => `<button class="btn" type="button" data-dm="give" data-n="${x.points}" aria-label="${esc(x.name)}, ${x.points} damage points on lane ${l + 1}">${esc(x.name)} +${x.points}</button>`).join(' ')}
          ${inc.length ? '' : `<button class="btn" type="button" data-dm="give" data-n="1" aria-label="One damage point on lane ${l + 1}">+1</button>`}
          <button class="btn" type="button" data-dm="take" data-n="-1" aria-label="Take back one damage point on lane ${l + 1}">−1</button></td></tr>`).join('')}</tbody></table></div>`;
    const row = l => box.querySelector(`tr[data-lane="${l}"]`);
    box.onclick = ev => {
      const b = ev.target.closest && ev.target.closest('button[data-dm]'); if (!b || b.disabled) return;
      if (b.blur) b.blur();
      const tr = b.closest('tr'); if (!tr) return;
      o.send(Number(tr.dataset.lane), Number(b.dataset.n));
    };
    const set = (el, text) => { if (el && el.textContent !== text) el.textContent = text; };
    function update() {
      const v = Damage.view(getE(), o.lanes, o.now(), o.phase());
      box.hidden = !v.on; if (!v.on) return;
      set(box.querySelector('[data-dm="info"]'), v.info);
      const shown = new Set(v.rows.map(r => r.lane));
      o.lanes.forEach(l => { const tr = row(l); if (tr) tr.hidden = !shown.has(l); });
      v.rows.forEach(r => {
        const tr = row(r.lane); if (!tr) return;
        const q = s => tr.querySelector(`[data-dm="${s}"]`);
        set(q('who'), r.who); set(q('points'), String(r.points)); set(q('note'), r.note);
        const chip = q('chip'); set(chip, r.chip); const cls = 'dmchip dm-' + r.kind; if (chip.className !== cls) chip.className = cls;
        tr.querySelectorAll('button[data-dm="give"]').forEach(b => { b.disabled = !r.give; });
        tr.querySelectorAll('button[data-dm="take"]').forEach(b => { b.disabled = !r.take; });
      });
    }
    return { update };
  }
  return { build };
})();

// Car Failures on screen (1.44.0): the panel of the Race Director to give a car a failure or clear the one it has (race screen and Race Director page). What it shows is worked out in failures.js (Failures.view);
// this file only draws it and passes on what is pressed. Built once; update() only changes what changed, so a list you are choosing from is not drawn again.
// o: { eng (the engine, or a function that gives the current one), lanes: [lane numbers (0...)], failures: [{ k, name, chance }] (the failures of the system), phase(), now(),
//      send(lane, k) (give the failure k of the list, or -1 for one at random), clear(lane) }
const FailurePanel = (() => {
  const esc = x => String(x).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  function build(box, o) {
    const getE = () => (typeof o.eng === 'function' ? o.eng() : o.eng), list = Array.isArray(o.failures) ? o.failures : [];
    box.hidden = false;
    box.innerHTML = `<div class="bophead"><strong>Car Failures</strong><span class="muted" data-fl="info"></span></div>
      <div class="wrap"><table class="fields dmtable"><thead><tr><th>Lane</th><th>Car</th><th>Failure</th><th>What it asks</th><th>Give a failure</th><th>Clear</th></tr></thead><tbody>${o.lanes.map(l => `<tr data-lane="${l}">
        <td><strong>${l + 1}</strong></td><td data-fl="who"></td><td><span class="dmchip dm-ok" data-fl="chip"></span></td><td class="muted" data-fl="note"></td>
        <td class="actions"><select data-fl="pick" aria-label="The failure to give on lane ${l + 1}"><option value="-1">At random</option>${list.map(f => `<option value="${f.k}">${esc(f.name)} (${esc(f.chance)}%)</option>`).join('')}</select>
          <button class="btn" type="button" data-fl="give" aria-label="Give the car on lane ${l + 1} the failure that is chosen">Give</button></td>
        <td class="actions"><button class="btn" type="button" data-fl="clear" aria-label="Clear the failure of the car on lane ${l + 1}">Clear</button></td></tr>`).join('')}</tbody></table></div>`;
    const row = l => box.querySelector(`tr[data-lane="${l}"]`);
    box.onclick = ev => {
      const b = ev.target.closest && ev.target.closest('button[data-fl]'); if (!b || b.disabled) return;
      if (b.blur) b.blur();
      const tr = b.closest('tr'); if (!tr) return;
      const lane = Number(tr.dataset.lane);
      if (b.dataset.fl === 'clear') o.clear(lane);
      else { const sel = tr.querySelector('select[data-fl="pick"]'); o.send(lane, sel ? Number(sel.value) : -1); }
    };
    const set = (el, text) => { if (el && el.textContent !== text) el.textContent = text; };
    function update() {
      const v = Failures.view(getE(), o.lanes, o.now(), o.phase());
      box.hidden = !v.on; if (!v.on) return;
      set(box.querySelector('[data-fl="info"]'), v.info);
      const shown = new Set(v.rows.map(r => r.lane));
      o.lanes.forEach(l => { const tr = row(l); if (tr) tr.hidden = !shown.has(l); });
      v.rows.forEach(r => {
        const tr = row(r.lane); if (!tr) return;
        const q = s => tr.querySelector(`[data-fl="${s}"]`);
        set(q('who'), r.who); set(q('note'), r.note);
        const chip = q('chip'); set(chip, r.chip); const cls = 'dmchip dm-' + r.kind; if (chip.className !== cls) chip.className = cls;
        q('give').disabled = !r.give; q('pick').disabled = !r.give; q('clear').disabled = !r.clear;
      });
    }
    return { update };
  }
  return { build };
})();
