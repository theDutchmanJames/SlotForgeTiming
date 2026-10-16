// Tyre Change on screen (1.32.0): the folder of the Race Director (race screen and Race Director page) where he gives a car another tyre, in every race, with or without weather.
// 1.31.0 had this choice in the Weather folder; it is here now so that every race has it. What it means is in engine.js (setTyre) and weather.js (tyreView); this file only draws and passes on what is chosen.
// o: { eng (the engine, or a function that gives the current one: the race window's, or the one a viewer follows), lanes: [lane numbers (0...)], phase() (the phase of the race screen),
//      weather (true when the race has weather: Wet and Intermediate come from the pit stops then, so they can not be chosen), setTyre(lane, code, save) (save: true when he also wants it kept on the Slotcar in the Database) }
// Built once; update() only changes what changed, so a choice never moves under a finger.
const TyrePanel = (() => {
  let saveTyre = false; // the tick box "also save it in the Database" is remembered while the app is open (it is a habit more than a choice per race)
  function build(box, o) {
    const getE = () => (typeof o.eng === 'function' ? o.eng() : o.eng);
    box.hidden = false;
    box.innerHTML = `<p class="muted hint tyhint">Pick another tyre for a car when its driver changes tyres during the race.${o.weather ? ' In this race Wet and Intermediate tyres come from the pit stops (see Weather): here you choose the dry tyre a car races on, and goes back to.' : ''}</p>
      <div class="wrap"><table class="fields boptable wxtable tytable"><thead><tr><th>Lane</th><th>Driver</th><th>Tyres</th><th>Tyre choice</th></tr></thead><tbody>${o.lanes.map(l => `<tr data-lane="${l}">
        <td><strong>${l + 1}</strong></td><td data-ty="who"></td><td><span class="tyrechip" data-ty="tyre"></span></td><td><select data-ty-own="${l}" aria-label="Tyre choice of lane ${l + 1}">${Wx.TYRES.map(t => `<option value="${t.code}"${o.weather && t.cls !== 'dry' ? ' disabled' : ''}>${t.name}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>
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
      v.rows.forEach(r => {
        const tr = box.querySelector(`tr[data-lane="${r.lane}"]`); if (!tr) return;
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
