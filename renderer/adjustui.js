// The Adjust panel (1.13.0): pick a lane, then use the pads (penalty points, damage points, time, laps, championship points) for that lane, and take the last one back with Undo.
// One builder for both places: the Adjust folder of the Race Director page (it sends a command to the race window) and the Adjust panel on the Race tab of the main window (it adjusts the race itself).
// What the pads do and look like is in adjustpad.js; this file draws the panel, keeps the lane that is picked and what was done (for Undo), and switches the pads on and off.
// Built once; update() only changes what changed (a typed amount in the field of a pad stays), and draws the pads again only when the values or the layout in the settings changed.
// o: { eng (the engine, or a function that gives the current one), lanes: [lane numbers (0...)], phase() (running, paused, ...), now() (the clock of the screen, for the damage system),
//      penalty() (is there a penalty system), damage() (is there a damage system), champ() (are there championship points), settings() (default: the app settings),
//      send(group, lane, amount) (the adjustment), refresh() (draw the whole page again; default: update), raceKey() (changes with the race or heat: the lane and Undo start again),
//      memory ({ lane, hist, key }: kept by the page when it builds the panel again), id (prefix of the ids, default 'adj'), find(id) (default: document.getElementById), title, bind (default true: take the clicks) }
const AdjustPanel = (() => {
  const esc = x => String(x).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  // the number a pad changes, for the car on a lane (in the unit of the pad: points, seconds, laps)
  const valueOf = (eng, lane, group) => {
    const c = eng.cars.find(x => x.lane === lane);
    return !c ? null : group === 'points' ? c.points : group === 'damage' ? (c.dmg || 0) : group === 'time' ? Math.round(c.adjMs || 0) / 1000 : group === 'laps' ? (c.adjLaps || 0) : (c.adjPoints || 0);
  };
  function build(box, o) {
    const getE = () => (typeof o.eng === 'function' ? o.eng() : o.eng), pre = o.id || 'adj', find = o.find || (id => document.getElementById(id));
    const S = () => (o.settings ? o.settings() : (typeof state !== 'undefined' && state.settings) || {});
    const mem = o.memory || { lane: null, hist: AdjustPad.history(), key: undefined }, hist = mem.hist;
    const lanes = o.lanes, when = () => performance.now();
    let sig = '';
    const refresh = () => (o.refresh ? o.refresh() : update());
    function draw() {
      const s = S(), lay = AdjustPad.layoutOf(s);
      box.innerHTML = `${o.title ? `<div class="bophead"><strong>${esc(o.title)}</strong><span class="muted">Penalty points, damage points, time, laps and championship points for one lane</span></div>` : ''}
        <div class="adj-lanes" role="group" aria-label="Choose a lane">${lanes.map(l => `<button type="button" class="btn adj-lane" data-adj-lane="${l}" aria-pressed="false"><strong>Lane ${l + 1}</strong><small></small></button>`).join('')}</div>
        <p class="adj-who" id="${pre}-who" aria-live="polite"></p>
        <div class="adj-pads" id="${pre}-pads">${AdjustPad.padsHtml(s, {})}</div>
        <p class="adj-line"><span id="${pre}-last" class="muted" aria-live="polite"></span> <button type="button" class="btn" data-adj-undo>Undo</button></p>
        <p class="adj-layout"><span class="muted">Pads:</span> <button type="button" class="btn" data-adj-layout="h" aria-pressed="${lay === 'h'}">Horizontal</button> <button type="button" class="btn" data-adj-layout="v" aria-pressed="${lay === 'v'}">Vertical</button>
          <span class="muted">The values are set in App Settings, Race Director, and per race setup (its Adjust pads folder).</span></p>`;
      sig = AdjustPad.signature(s);
    }
    function press(pb) {
      if (pb.disabled || mem.lane === null) return;
      const r = AdjustPad.read(pb), eng = getE(), car = eng.cars.find(c => c.lane === mem.lane); if (!r || !car) return;
      hist.push({ lane: mem.lane, group: r.group, amount: r.amount, text: AdjustPad.describe(r.group, r.amount, car.driverName), before: valueOf(eng, mem.lane, r.group), at: when() });
      o.send(r.group, mem.lane, r.amount);
      refresh();
    }
    function undo() {
      const u = hist.undo(); if (u) o.send(u.group, u.lane, u.amount);
      refresh();
    }
    async function layout(v) {
      const next = await api.setSettings({ padLayout: v === 'v' ? 'v' : 'h' });
      if (typeof state !== 'undefined') state.settings = next;
      refresh();
    }
    // a click somewhere in the panel (t: the element that was clicked)
    function click(t) {
      if (!t || !t.closest) return;
      const pick = t.closest('[data-adj-lane]'); if (pick) { if (!pick.disabled) { mem.lane = Number(pick.dataset.adjLane); refresh(); } return; }
      const pad = t.closest('[data-pad-do]'); if (pad) return press(pad);
      if (t.closest('[data-adj-undo]')) { if (hist.canUndo()) undo(); return; }
      const lay = t.closest('[data-adj-layout]'); if (lay) layout(lay.dataset.adjLayout);
    }
    // what the panel can do for this race: false when none of the pads applies (e.g. a practice without penalty or damage system)
    function usable() {
      const eng = getE(), dv = o.damage && o.damage() ? Damage.view(eng, lanes, o.now(), o.phase()) : null;
      return !!((o.penalty && o.penalty()) || (dv && dv.on) || eng.type === 'race' || eng.type === 'timed');
    }
    function update() {
      if (AdjustPad.signature(S()) !== sig) draw();
      const eng = getE(), phase = o.phase(), on = phase === 'running' || phase === 'paused', pen = !!(o.penalty && o.penalty());
      const key = o.raceKey ? o.raceKey() : ''; if (mem.key !== key) { mem.key = key; mem.lane = null; hist.clear(); }
      if (mem.lane !== null && !lanes.includes(mem.lane)) mem.lane = null;
      const car = mem.lane === null ? null : eng.cars.find(c => c.lane === mem.lane), canAdj = eng.type === 'race' || eng.type === 'timed';
      const dv = o.damage && o.damage() ? Damage.view(eng, lanes, o.now(), phase) : null, drow = dv && dv.on && car ? dv.rows.find(r => r.lane === car.lane) : null; // (what the damage panel allows for this lane)
      const champ = !!(o.champ && o.champ());
      box.querySelectorAll('[data-adj-lane]').forEach(b => {
        const l = Number(b.dataset.adjLane), c = eng.cars.find(x => x.lane === l), sm = b.querySelector ? b.querySelector('small') : null;
        b.setAttribute('aria-pressed', String(l === mem.lane)); b.disabled = !on; b.hidden = !c; if (sm && c) sm.textContent = c.driverName; // (a lane without a car has no button)
      });
      find(`${pre}-who`).textContent = !on ? 'The pads work while the race is running or paused.' : car ? `Lane ${car.lane + 1} · ${car.driverName}` : 'Choose a lane. The pads act on that lane.';
      box.querySelectorAll('.pad').forEach(p => {
        const id = p.dataset.pad;
        p.hidden = (id === 'points' && !pen) || (id === 'damage' && !(dv && dv.on)) || (id !== 'points' && id !== 'damage' && !canAdj) || (id === 'champ' && !champ);
        p.querySelectorAll('button,input').forEach(el => {
          const minus = !!el.dataset && el.dataset.sign === '-1';
          el.disabled = !on || !car || (id === 'points' && (car.dq || (minus && car.points <= 0))) || (id === 'damage' && (!drow || (minus ? !drow.take : !drow.give)));
        });
      });
      hist.settle((l, g) => valueOf(eng, l, g), when());
      box.querySelectorAll('[data-adj-undo]').forEach(b => { b.disabled = !on || !hist.canUndo(); });
      find(`${pre}-last`).textContent = hist.line();
      box.querySelectorAll('[data-adj-layout]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.adjLayout === AdjustPad.layoutOf(S()))));
    }
    draw();
    if (o.bind !== false) box.onclick = ev => click(ev.target);
    return { update, click, usable, draw, memory: mem };
  }
  return { build, valueOf };
})();
