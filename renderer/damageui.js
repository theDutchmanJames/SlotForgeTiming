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
