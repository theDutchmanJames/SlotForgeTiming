// The Endurance Race on screen: the swap panel (race screen and Race Director page). What it shows is worked out in endurance.js (Endurance.view);
// this file only draws it and passes on what is pressed. Built once; update() only changes what changed, so a list that is open (or a button under a finger) is not drawn again.
// o: { eng (the engine, or a function that gives the current one: the race window's, or the one a viewer follows), lanes: [lane numbers (0...)], phase() (the phase of the race screen),
//      now() (the time of the screen, as performance.now()), send(lane, what, id) (what: 'swap' | 'next'; id: the driver who steps in, or who is next) }
const EndurancePanel = (() => {
  function build(box, o) {
    const getE = () => (typeof o.eng === 'function' ? o.eng() : o.eng);
    box.hidden = false;
    box.innerHTML = `<div class="bophead"><strong>Endurance: driver swaps</strong><span class="muted" data-en="info"></span></div>
      <div class="wrap"><table class="fields entable"><thead><tr><th>Lane</th><th>Team</th><th>At the wheel</th><th>Swap</th><th>Next driver</th><th></th></tr></thead><tbody>${o.lanes.map(l => `<tr data-lane="${l}">
        <td><strong>${l + 1}</strong></td><td data-en="team"></td><td><span data-en="driver"></span> <span class="muted" data-en="stint"></span></td>
        <td><span class="enchip en-ok" data-en="chip"></span> <span class="muted" data-en="why"></span></td>
        <td><select data-en="next" aria-label="Next driver for lane ${l + 1}" hidden></select><span data-en="nextname"></span></td>
        <td><button class="btn" type="button" data-en="swap" aria-label="Swap done on lane ${l + 1}">Swap done</button></td></tr>
        <tr data-lane2="${l}"><td></td><td colspan="5" class="muted" data-en="totals"></td></tr>`).join('')}</tbody></table></div>`;
    const row = l => box.querySelector(`tr[data-lane="${l}"]`), row2 = l => box.querySelector(`tr[data-lane2="${l}"]`);
    const sel = tr => tr.querySelector('[data-en="next"]');
    box.onclick = ev => {
      const b = ev.target.closest && ev.target.closest('button[data-en="swap"]'); if (!b || b.disabled) return;
      if (b.blur) b.blur();
      const tr = b.closest('tr'); if (!tr) return;
      const s = sel(tr); o.send(Number(tr.dataset.lane), 'swap', s && !s.hidden && s.value ? s.value : undefined);
    };
    box.onchange = ev => {
      const s = ev.target; if (!s || !s.dataset || s.dataset.en !== 'next') return;
      const tr = s.closest('tr'); if (tr && s.value) o.send(Number(tr.dataset.lane), 'next', s.value);
    };
    const set = (el, text) => { if (el && el.textContent !== text) el.textContent = text; };
    function update() {
      const v = Endurance.view(getE(), o.lanes, o.now(), o.phase());
      box.hidden = !v.on; if (!v.on) return;
      set(box.querySelector('[data-en="info"]'), v.info);
      const shown = new Set(v.rows.map(r => r.lane));
      o.lanes.forEach(l => { const tr = row(l), t2 = row2(l); if (tr) tr.hidden = !shown.has(l); if (t2) t2.hidden = !shown.has(l); });
      v.rows.forEach(r => {
        const tr = row(r.lane), t2 = row2(r.lane); if (!tr) return;
        const q = s => tr.querySelector(`[data-en="${s}"]`);
        set(q('team'), r.team); set(q('driver'), r.driver); set(q('stint'), r.stint);
        const chip = q('chip'); set(chip, r.chip + (r.standing !== null ? ` · stand still ${r.standing} s` : '')); const cls = 'enchip en-' + r.kind; if (chip.className !== cls) chip.className = cls;
        set(q('why'), r.why);
        const s = sel(tr), nm = q('nextname');
        if (r.chosen) { // the Race Director chooses: a list of the drivers, those who can not step in shown with the reason
          nm.hidden = true; s.hidden = false;
          const sig = r.choices.map(c => `${c.id}:${c.ok ? 1 : 0}:${c.why}`).join('|');
          if (s.dataset.sig !== sig) { s.dataset.sig = sig; s.innerHTML = r.choices.map(c => `<option value="${c.id}"${c.ok ? '' : ' disabled'}>${(c.name || '?').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]))}${c.ok ? '' : ' (' + c.why + ')'}</option>`).join(''); }
          if (r.next && s.value !== r.next) s.value = r.next;
        } else { s.hidden = true; nm.hidden = false; set(nm, r.nextName ? r.nextName : '–'); }
        const b = q('swap'); b.hidden = !r.button.show; b.disabled = r.button.disabled; set(b, r.button.text);
        if (t2) set(t2.querySelector('[data-en="totals"]'), 'Driven: ' + r.totals.map(x => `${x.name} ${x.text}${x.now ? ' (now)' : ''}`).join(' · ') + (r.swaps ? ` · ${r.swaps} ${r.swaps === 1 ? 'swap' : 'swaps'}` : ''));
      });
    }
    return { update };
  }
  return { build };
})();
