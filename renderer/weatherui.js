// Weather on screen: the controls of the Race Director (race screen and Race Director page): the weather now and what comes next, the buttons to set it, and the cars with their tyres.
// What it all means is in weather.js, what the cars get is in engine.js; this file only draws and passes on what is pressed.
// o: { eng (the engine, or a function that gives the current one: the race window's, or the one a viewer follows), lanes: [lane numbers (0...)], phase() (the phase of the race screen), now() (the time of the race clock),
//      send(state) (state: dry | cloudy | wet | clearing) }
// Built once; update() only changes what changed, so a button never moves under a finger.
const WeatherPanel = (() => {
  const ICON = { dry: '☀️', cloudy: '☁️', wet: '🌧️', clearing: '🌤️' };
  function build(box, o) {
    const getE = () => (typeof o.eng === 'function' ? o.eng() : o.eng);
    box.hidden = false;
    box.innerHTML = `<div class="bophead"><strong>Weather</strong><span data-wx="info" class="muted"></span></div>
      <div class="tkbtns wxbtns" role="group" aria-label="Weather">${Wx.STATES.map(([s, t]) => `<button class="btn" type="button" data-wx="${s}" aria-pressed="false">${ICON[s]} ${t}</button>`).join('')}</div>
      <div class="wrap"><table class="fields boptable wxtable"><thead><tr><th>Lane</th><th>Driver</th><th>Tyres</th><th>To do</th><th>Hindered</th></tr></thead><tbody>${o.lanes.map(l => `<tr data-lane="${l}">
        <td><strong>${l + 1}</strong></td><td data-wx="who"></td><td><span class="tyrechip" data-wx="tyre"></span></td><td data-wx="todo"></td><td data-wx="hinder"></td></tr>`).join('')}</tbody></table></div>`;
    box.onclick = ev => {
      const b = ev.target.closest && ev.target.closest('button[data-wx]'); if (!b || b.disabled) return;
      if (b.blur) b.blur();
      o.send(b.dataset.wx);
    };
    const set = (el, text) => { if (el && el.textContent !== text) el.textContent = text; };
    function update() {
      const v = Wx.view(getE(), o.phase(), o.now ? o.now() : 0, o.lanes);
      box.hidden = !v.on; if (!v.on) return;
      set(box.querySelector('[data-wx="info"]'), v.info);
      v.buttons.forEach(b => {
        const bt = box.querySelector(`button[data-wx="${b.state}"]`); if (!bt) return;
        bt.disabled = b.disabled;
        const pressed = b.on ? 'true' : 'false'; if (bt.getAttribute && bt.getAttribute('aria-pressed') !== pressed && bt.setAttribute) bt.setAttribute('aria-pressed', pressed);
      });
      v.rows.forEach(r => {
        const tr = box.querySelector(`tr[data-lane="${r.lane}"]`); if (!tr) return;
        const q = s => tr.querySelector(`[data-wx="${s}"]`);
        set(q('who'), r.who); set(q('todo'), r.todo); set(q('hinder'), r.hinderText);
        const chip = q('tyre'); set(chip, `${r.code} ${r.tyre}`);
        if (chip && chip.style && chip.style.background !== r.color) chip.style.background = r.color;
      });
    }
    return { update };
  }
  return { build };
})();
