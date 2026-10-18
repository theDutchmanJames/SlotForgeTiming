// Tyre Change on screen (1.32.0): the folder of the Race Director (race screen and Race Director page) where he gives a car another tyre, in every race, with or without weather.
// 1.31.0 had this choice in the Weather folder; it is here now so that every race has it. What it means is in engine.js (setTyre) and weather.js (tyreView); this file only draws and passes on what is chosen.
// o: { eng (the engine, or a function that gives the current one: the race window's, or the one a viewer follows), lanes: [lane numbers (0...)], phase() (the phase of the race screen),
//      wear (true when the race has Tyre Wear, 1.40.0: the table then shows the life, what is left, the grip effect and the state of every car), now() (the clock of the screen, as performance.now()),
//      weather (true when the race has weather: Wet and Intermediate come from the pit stops then, so they can not be chosen), setTyre(lane, code, save) (save: true when he also wants it kept on the Slotcar in the Database) }
// Built once; update() only changes what changed, so a choice never moves under a finger.
const TyrePanel = (() => {
  let saveTyre = false; // the tick box "also save it in the Database" is remembered while the app is open (it is a habit more than a choice per race)
  function build(box, o) {
    const getE = () => (typeof o.eng === 'function' ? o.eng() : o.eng);
    box.hidden = false;
    box.innerHTML = `<p class="muted hint tyhint">Pick another tyre for a car when its driver changes tyres during the race.${o.weather ? ' In this race Wet and Intermediate tyres come from the pit stops (see Weather): here you choose the dry tyre a car races on, and goes back to.' : ''}</p>
      <div class="wrap"><table class="fields boptable wxtable tytable"><thead><tr><th>Lane</th><th>Driver</th><th>Tyres</th>${o.wear ? '<th>Life</th><th>Left</th><th>Grip effect</th><th>State</th>' : ''}<th>Tyre choice</th></tr></thead><tbody>${o.lanes.map(l => `<tr data-lane="${l}">
        <td><strong>${l + 1}</strong></td><td data-ty="who"></td><td><span class="tyrechip" data-ty="tyre"></span></td>${o.wear ? '<td class="twlifecell"><strong data-ty="life"></strong><span class="twbar"><i data-ty="bar"></i></span></td><td data-ty="left"></td><td data-ty="effect"></td><td><span class="twstate" data-ty="state"></span></td>' : ''}<td><select data-ty-own="${l}" aria-label="Tyre choice of lane ${l + 1}">${Wx.TYRES.map(t => `<option value="${t.code}"${o.weather && t.cls !== 'dry' ? ' disabled' : ''}>${t.name}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>
      <label class="inline wxsave"><input type="checkbox" data-ty-save="1"${saveTyre ? ' checked' : ''}> Also change the tyre choice of the Slotcar in the Database</label><span class="muted hint">Not ticked: the tyre is changed for this race only.</span>`;
    box.onchange = ev => { // the Race Director picks another tyre for a car, or ticks the box that keeps it on the Slotcar too
      const s = ev.target; if (!s || !s.dataset) return;
      if (s.dataset.tySave !== undefined) { saveTyre = !!s.checked; return; }
      if (s.dataset.tyOwn === undefined || s.disabled) return;
      if (s.blur) s.blur(); // (so the page shows what the race says, from now on)
      o.setTyre(Number(s.dataset.tyOwn), s.value, saveTyre);
    };
    const set = (el, text) => { if (el && el.textContent !== text) el.textContent = text; };
    function update() {
      const v = Wx.tyreView(getE(), o.phase(), o.lanes);
      box.hidden = !v.on; if (!v.on) return;
      const wv = o.wear ? TyreWear.view(getE(), o.lanes, o.now ? o.now() : (typeof performance !== 'undefined' ? performance.now() : 0)) : null, wrow = l => (wv && wv.rows.find(x => x.lane === l)) || null;
      v.rows.forEach(r => {
        const tr = box.querySelector(`tr[data-lane="${r.lane}"]`); if (!tr) return;
        if (wv) { // Tyre Wear: the life of the tyres, what is left, what the grip does to the car and what the car is doing
          const w = wrow(r.lane), q2 = s => tr.querySelector(`[data-ty="${s}"]`), st = w ? TyreWear.stateOf(w) : { text: '', cls: '' };
          set(q2('life'), w ? `${w.shown}%` : ''); set(q2('left'), w ? w.leftText : ''); set(q2('effect'), w && w.effect !== null ? w.effectText : '–'); set(q2('state'), st.text);
          const bar = q2('bar'); if (bar && bar.style) { const pct = w ? `${Math.max(0, Math.min(100, w.life))}%` : '0%'; if (bar.style.width !== pct) bar.style.width = pct; }
          const cls = `tw-${(w && w.level) || 'ok'}`;
          if (tr.dataset && tr.dataset.twl !== cls) { tr.dataset.twl = cls; ['tw-ok', 'tw-warn', 'tw-crit', 'tw-out'].forEach(c => tr.classList.remove(c)); tr.classList.add(cls); }
          const stEl = q2('state'); if (stEl && stEl.dataset && stEl.dataset.cls !== st.cls) { stEl.dataset.cls = st.cls; stEl.className = `twstate tws-${st.cls}`; }
        }
        const q = s => tr.querySelector(`[data-ty="${s}"]`);
        set(q('who'), r.who);
        const chip = q('tyre'); set(chip, `${r.code} ${r.tyre}`);
        if (chip && chip.style && chip.style.background !== r.color) chip.style.background = r.color;
        const own = tr.querySelector('select[data-ty-own]'); // (the choice follows the race, but never moves under a finger that is choosing)
        if (own) { own.disabled = !v.open; if (own.value !== r.ownCode && !(typeof document !== 'undefined' && document.activeElement === own)) own.value = r.ownCode; }
      });
    }
    return { update };
  }
  return { build };
})();
