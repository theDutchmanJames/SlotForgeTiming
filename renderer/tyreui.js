// Tyre Change on screen (1.32.0): the folder of the Race Director (race screen and Race Director page) where he gives a car another tyre, in every race, with or without weather.
// 1.31.0 had this choice in the Weather folder; it is here now so that every race has it. What it means is in engine.js (setTyre) and weather.js (tyreView); this file only draws and passes on what is chosen.
// o: { eng (the engine, or a function that gives the current one: the race window's, or the one a viewer follows), lanes: [lane numbers (0...)], phase() (the phase of the race screen),
//      wear (true when the race has Tyre Wear, 1.40.0: the table then shows the life, what is left, the grip effect and the state of every car), now() (the clock of the screen, as performance.now()),
//      sets (true when the race has a limit on the sets, 1.41.0: the table shows the sets left of every car), queue(lane, code) (the Race Director queues a tyre for the next stop; code '' clears it),
//      weather (true when the race has weather: Wet and Intermediate come from the pit stops then, so they can not be chosen), setTyre(lane, code, save) (save: true when he also wants it kept on the Slotcar in the Database) }
// Built once; update() only changes what changed, so a choice never moves under a finger.
const TyrePanel = (() => {
  let saveTyre = false; // the tick box "also save it in the Database" is remembered while the app is open (it is a habit more than a choice per race)
  function build(box, o) {
    const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const getE = () => (typeof o.eng === 'function' ? o.eng() : o.eng);
    const Wx = globalThis.Wx.withTyres(getE()?.cfg?.tyrewear?.tyres), TyreWear = globalThis.TyreWear.withTyres(getE()?.cfg?.tyrewear?.tyres);
    box.hidden = false;
    const tyreName = code => (Wx.tyreOf(code) || {}).name || code;
    const letter = code => { const icon=Wx.tyreOf(code)?.icon||code;return icon==='INT'?'I':icon; };
    if (o.wear) { // Tyre Wear (1.40.0, the next stop and the sets 1.41.0): the table of the cars, the tyre for the next stop, and the correction of the Race Director
      const setsCell = o.sets ? `<td class="twsetscell">${Wx.TYRES.map(t => `<span class="twsc" data-sc="${t.code}" style="--tc:${t.color}" title="${esc(t.name)}"><b>${letter(t.code)}</b><i>0</i></span>`).join('')}</td>` : '';
      box.innerHTML = `<p class="muted hint tyhint">Choose the tyre a car gets at its next pit stop. Every stop changes the tyres${o.sets ? ' and takes one set out of the box; a tyre with no sets left can not be picked' : ''}.${o.weather ? ' The weather selects the tyre category. A queued custom Intermediate or Wet tyre waits until that category is needed.' : ''}</p>
        <div class="twnote" data-ty="wxnote" hidden></div>
        <div class="twnote twmand" data-ty="mandnote" hidden></div>
        <div class="wrap"><table class="fields boptable wxtable tytable"><thead><tr><th>Lane</th><th>Driver</th><th>Tyres now</th><th>Life</th><th>Left</th><th>Grip effect</th>${o.sets ? '<th>Sets left</th>' : ''}<th>Next stop</th><th>State</th></tr></thead><tbody>${o.lanes.map(l => `<tr data-lane="${l}">
          <td><strong>${l + 1}</strong></td><td data-ty="who"></td><td><span class="tyrechip" data-ty="tyre"></span></td><td class="twlifecell"><strong data-ty="life"></strong><span class="twbar"><i data-ty="bar"></i></span></td><td data-ty="left"></td><td data-ty="effect"></td>${setsCell}
          <td><select data-ty-next="${l}" aria-label="Tyre for the next stop of lane ${l + 1}">${['', ...Wx.TYRES.map(t => t.code)].map(c => `<option value="${c}">${c ? esc(tyreName(c)) : 'Same'}</option>`).join('')}</select><span class="twnotesm" data-ty="nnote"></span></td><td><span class="twstate" data-ty="state"></span></td></tr>`).join('')}</tbody></table></div>
        <div class="twfix"><strong>Correct the tyres now</strong> <span class="muted">(the tyre was fitted before the race, or the Race Director got it wrong: the life stays as it is)</span>
          <div class="row"><select data-ty-fixlane aria-label="Lane">${o.lanes.map(l => `<option value="${l}">Lane ${l + 1}</option>`).join('')}</select>
            <select data-ty-fixtyre aria-label="Tyre">${Wx.TYRES.map(t => `<option value="${t.code}"${o.weather && t.cls !== 'dry' ? ' disabled' : ''}>${esc(t.name)}</option>`).join('')}</select>
            <button type="button" class="btn" data-ty-fix="1">Change</button></div>
          <label class="inline wxsave"><input type="checkbox" data-ty-save="1"${saveTyre ? ' checked' : ''}> Also change the tyre choice of the Slotcar in the Database</label><span class="muted hint">The car keeps the life of the tyre it has. For a real change with new tyres use Next stop above.</span></div>`;
    } else {
        box.innerHTML = `<p class="muted hint tyhint">Pick another tyre for a car when its driver changes tyres during the race.${o.weather ? ' In this race Wet and Intermediate tyres come from the pit stops (see Weather): here you choose the dry tyre a car races on, and goes back to.' : ''}</p>
      <div class="wrap"><table class="fields boptable wxtable tytable"><thead><tr><th>Lane</th><th>Driver</th><th>Tyres</th>${o.wear ? '<th>Life</th><th>Left</th><th>Grip effect</th><th>State</th>' : ''}<th>Tyre choice</th></tr></thead><tbody>${o.lanes.map(l => `<tr data-lane="${l}">
        <td><strong>${l + 1}</strong></td><td data-ty="who"></td><td><span class="tyrechip" data-ty="tyre"></span></td>${o.wear ? '<td class="twlifecell"><strong data-ty="life"></strong><span class="twbar"><i data-ty="bar"></i></span></td><td data-ty="left"></td><td data-ty="effect"></td><td><span class="twstate" data-ty="state"></span></td>' : ''}<td><select data-ty-own="${l}" aria-label="Tyre choice of lane ${l + 1}">${Wx.TYRES.map(t => `<option value="${t.code}"${o.weather && t.cls !== 'dry' ? ' disabled' : ''}>${esc(t.name)}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>
      <label class="inline wxsave"><input type="checkbox" data-ty-save="1"${saveTyre ? ' checked' : ''}> Also change the tyre choice of the Slotcar in the Database</label><span class="muted hint">Not ticked: the tyre is changed for this race only.</span>`;
    }
    box.onchange = ev => { // the Race Director picks another tyre for a car, or ticks the box that keeps it on the Slotcar too
      const s = ev.target; if (!s || !s.dataset) return;
      if (s.dataset.tySave !== undefined) { saveTyre = !!s.checked; return; }
      if (s.dataset.tyNext !== undefined) { // the tyre for the next stop (Tyre Wear): '' is the same tyre
        if (s.disabled) return; if (s.blur) s.blur();
        if (o.queue) o.queue(Number(s.dataset.tyNext), s.value);
        return;
      }
      if (s.dataset.tyOwn === undefined || s.disabled) return;
      if (s.blur) s.blur(); // (so the page shows what the race says, from now on)
      o.setTyre(Number(s.dataset.tyOwn), s.value, saveTyre);
    };
    box.onclick = ev => { // the correction of the Race Director (Tyre Wear): the tyre of a lane is changed now, the life stays
      const b = ev && ev.target && ev.target.closest ? ev.target.closest('[data-ty-fix]') : null; if (!b || b.disabled) return;
      const lane = box.querySelector('[data-ty-fixlane]'), tyre = box.querySelector('[data-ty-fixtyre]');
      if (lane && tyre && o.setTyre) o.setTyre(Number(lane.value), tyre.value, saveTyre);
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
          set(q2('life'), w ? `${w.shown}%` : ''); set(q2('left'), w ? w.leftText : ''); set(q2('effect'), w && w.effect !== null ? w.effectText : '–'); set(q2('state'), st.text+(w?.temperature ? ` · Simulated ${Math.round(w.temperature.value)}°C · ${w.temperature.label} · wear ×${w.temperature.multiplier.toFixed(2)}` : ''));
          const bar = q2('bar'); if (bar && bar.style) { const pct = w ? `${Math.max(0, Math.min(100, w.life))}%` : '0%'; if (bar.style.width !== pct) bar.style.width = pct; }
          const cls = `tw-${(w && w.level) || 'ok'}`;
          if (tr.dataset && tr.dataset.twl !== cls) { tr.dataset.twl = cls; ['tw-ok', 'tw-warn', 'tw-crit', 'tw-out'].forEach(c => tr.classList.remove(c)); tr.classList.add(cls); }
          const stEl = q2('state'); if (stEl && stEl.dataset && stEl.dataset.cls !== st.cls) { stEl.dataset.cls = st.cls; stEl.className = `twstate tws-${st.cls}`; }
          if (w && w.sets) Wx.TYRES.forEach(t => { // the sets that are left of every tyre (dim at 0)
            const el = tr.querySelector(`[data-sc="${t.code}"]`), n = el && el.querySelector ? el.querySelector('i') : null; if (!el || !n) return;
            set(n, String(w.sets[t.code])); if (el.classList && el.classList.toggle) el.classList.toggle('zero', !(w.sets[t.code] > 0));
          });
          const nx = tr.querySelector('select[data-ty-next]'); // (the choice follows the race, but never moves under a finger that is choosing)
          if (nx && nx.options && w) {
            const ch = TyreWear.nextChoices(w, o.weather), focused = typeof document !== 'undefined' && document.activeElement === nx;
            if (!focused) {
              Array.from(nx.options).forEach((op, k) => { const c = ch[k]; if (!c) return; if (op.textContent !== c.text) op.textContent = c.text; if (op.disabled !== c.disabled) op.disabled = c.disabled; if (op.hidden !== c.hidden) op.hidden = c.hidden; });
              if (nx.value !== w.queued) nx.value = w.queued;
            }
            nx.disabled = !v.open || !!w.fitting;
          }
          set(q2('nnote'), TyreWear.nextNote(w));
        }
        const q = s => tr.querySelector(`[data-ty="${s}"]`);
        set(q('who'), r.who);
        const chip = q('tyre'); set(chip, `${r.code} ${r.tyre}`);
        if (chip && chip.style && chip.style.background !== r.color) chip.style.background = r.color;
        const own = tr.querySelector('select[data-ty-own]'); // (the choice follows the race, but never moves under a finger that is choosing)
        if (own) { own.disabled = !v.open; if (own.value !== r.ownCode && !(typeof document !== 'undefined' && document.activeElement === own)) own.value = r.ownCode; }
      });
      if (wv) {
        const wxn = box.querySelector('[data-ty="wxnote"]');
        if (wxn) { // the rain asks for its tyres at the next stop
          const names = [...new Set(wv.rows.filter(r => r.next && r.next.kind === 'weather').map(r => tyreName(r.next.code)))];
          const text = names.length ? `The weather asks for ${names.join(' or ')} tyres: every car changes to them at its next stop, from those sets. A tyre queued below goes on after that.` : '';
          if (wxn.textContent !== text) wxn.textContent = text; wxn.hidden = !text;
        }
        const mn = box.querySelector('[data-ty="mandnote"]');
        if (mn) { // the mandatory stops (1.52.0): the rule, and where every car stands with it
          const have = wv.rows.filter(r => r.mand), text = have.length ? `${have[0].mand.rule}. ${have.map(r => `Lane ${r.lane + 1}: ${TyreWear.mandStateText(r.mand)}`).join(' · ')}` : '';
          if (mn.textContent !== text) mn.textContent = text; mn.hidden = !text;
        }
        const fx = box.querySelector('[data-ty-fix]'); if (fx) fx.disabled = !v.open;
      }
    }
    return { update };
  }
  return { build };
})();
