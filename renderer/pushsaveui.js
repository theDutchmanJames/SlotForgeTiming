// Push and Save on screen (1.54.0): the folder of the Race Director (race screen and Race Director page) that shows how hard every car is driven and what that does to its tyres and its fuel.
// The rules are in pushsave.js and engine.js (psInfo); this file only draws what the race says. Nothing in it can be changed by the Race Director: the pace is the driver's.
// o: { eng (the engine, or a function that gives the current one: the race window's, or the one a viewer follows), lanes: [lane numbers (0...)], phase() }
// Built once; update() only changes what changed, so a choice (the lane of the lap by lap list) never moves under a finger.
const PushSavePanel = (() => {
  const PS = typeof PushSave !== 'undefined' ? PushSave : null;
  const SHOWN = 10; // laps in the lap by lap list
  const fixed1 = n => (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, '');
  // the line above the table: the rules of the system
  const rulesLine = cfg => `Push and Save: ${PS.rulesText(cfg)}${cfg.from > 1 ? `. The pace counts from lap ${cfg.from}` : ''}.`;
  const lapsText = n => `${n} lap${n === 1 ? '' : 's'}`;
  // the words of one row of the table, for car c of engine e (settings cfg): { who, kind, pill, pct, last, ref, tmult, fmult, tnow, fnow, tlaps }
  function rowTexts(e, c, cfg) {
    const v = e.psInfo(c), has = v.p !== null && v.p !== undefined, kind = has ? v.kind : 'normal';
    const lt = cfg.tyres.on && v.tyreLaps !== null ? `Tyres ${lapsText(Math.floor(v.tyreLaps))}` : '', lf = cfg.fuel.on && v.fuelLaps !== null ? `Fuel ${lapsText(Math.floor(v.fuelLaps))}` : '';
    return { who: c.driverName || 'Guest', kind, pill: PS.kindText(kind), pct: has ? `${PS.pctText(v.p)} over the reference` : PS.whyText(v.why) || '',
      last: c.laps.length ? RaceEngine.fmtTime(c.laps[c.laps.length - 1]) : '–', ref: v.ref > 0 ? `${RaceEngine.fmtTime(Math.round(v.ref))}${v.src ? ` (${PS.sourceText(v.src)})` : ''}` : 'none yet',
      tmult: cfg.tyres.on ? PS.multText(v.tyres) : '–', fmult: cfg.fuel.on ? PS.multText(v.fuel) : '–',
      tnow: cfg.tyres.on && v.tyreUsual > 0 ? `${fixed1(v.tyreNow)}% a lap (usual ${fixed1(v.tyreUsual)}%)` : '', fnow: cfg.fuel.on && v.fuelUsual > 0 ? `${fixed1(v.fuelNow)} L a lap (usual ${fixed1(v.fuelUsual)} L)` : '',
      tlaps: [lt, lf].filter(Boolean).join(' · ') || '–' };
  }
  // the rows of the lap by lap list of one car: its last laps, newest last
  function lapsHtml(car, cfg) {
    const n = car.laps.length, from = Math.max(0, n - SHOWN), rows = [];
    for (let i = from; i < n; i++) {
      const p = car.ps && car.ps[i] ? car.ps[i] : null, has = p && p.p !== null && p.p !== undefined, k = has ? p.k : 'normal';
      rows.push(`<tr><td>${i + 1}</td><td>${RaceEngine.fmtTime(car.laps[i])}</td><td>${has ? PS.pctText(p.p) : '–'}</td><td>${has ? `<span class="pspill psk-${k}">${PS.kindText(k)}</span>` : `<small class="pssub">${PS.whyText(p && p.w) || '–'}</small>`}</td><td>${p ? (cfg.tyres.on ? PS.multText(p.t) : '–') : '–'}</td><td>${p ? (cfg.fuel.on ? PS.multText(p.f) : '–') : '–'}</td></tr>`);
    }
    return rows.join('') || '<tr><td colspan="6"><small class="pssub">No laps yet.</small></td></tr>';
  }
  function build(box, o) {
    const getE = () => (typeof o.eng === 'function' ? o.eng() : o.eng);
    box.hidden = false;
    box.innerHTML = `<div class="psrules" data-ps="rules"></div>
      <div class="wrap"><table class="fields boptable pstable"><thead><tr><th>Lane</th><th>Driver</th><th>Pace</th><th>Last lap</th><th>Reference lap</th><th>Tyres now</th><th>Fuel now</th><th>Lasts at this pace</th></tr></thead><tbody>${o.lanes.map(l => `<tr data-lane="${l}">
        <td><strong>${l + 1}</strong></td><td data-ps="who"></td><td><span class="pspill" data-ps="pill"></span><small class="pssub" data-ps="pct"></small></td><td data-ps="last"></td><td data-ps="ref"></td>
        <td><b data-ps="tmult"></b><small class="pssub" data-ps="tnow"></small></td><td><b data-ps="fmult"></b><small class="pssub" data-ps="fnow"></small></td><td data-ps="tlaps"></td></tr>`).join('')}</tbody></table></div>
      <div class="psbylap"><label class="inline">Lap by lap for <select data-ps-lane aria-label="Lane for the lap by lap list">${o.lanes.map(l => `<option value="${l}">Lane ${l + 1}</option>`).join('')}</select></label>
        <div class="wrap"><table class="fields boptable pslaps"><thead><tr><th>Lap</th><th>Time</th><th>Over the reference</th><th>Pace</th><th>Tyres</th><th>Fuel</th></tr></thead><tbody data-ps="laps"></tbody></table></div></div>
      <p class="muted hint">PUSH: faster than normal pace, tyres and fuel wear more. NORMAL: the usual wear. SAVE: slower than normal pace, they last longer. The reference lap is the best lap of the driver on this track (the record) or, without one, his best lap so far in this race. Lap times and grip are never changed.</p>`;
    const set = (el, text) => { if (el && el.textContent !== text) el.textContent = text; };
    function update() {
      const e = getE(), cfg = e && e.pushSave ? e.pushSave : null; box.hidden = !cfg; if (box.hidden) return;
      set(box.querySelector('[data-ps="rules"]'), rulesLine(cfg));
      o.lanes.forEach(l => {
        const tr = box.querySelector(`tr[data-lane="${l}"]`), c = e.cars.find(x => x.lane === l); if (!tr || !c) return;
        const q = s => tr.querySelector(`[data-ps="${s}"]`), t = rowTexts(e, c, cfg);
        ['who', 'pct', 'last', 'ref', 'tmult', 'fmult', 'tnow', 'fnow', 'tlaps'].forEach(k => set(q(k), t[k]));
        const pill = q('pill'); set(pill, t.pill); if (pill && pill.dataset && pill.dataset.k !== t.kind) { pill.dataset.k = t.kind; pill.className = `pspill psk-${t.kind}`; }
      });
      const sel = box.querySelector('[data-ps-lane]'), car = e.cars.find(x => x.lane === Number(sel && sel.value)), body = box.querySelector('[data-ps="laps"]');
      if (body && car) { const html = lapsHtml(car, cfg); if (body.dataset && body.dataset.sig !== html) { body.dataset.sig = html; body.innerHTML = html; } }
    }
    return { update };
  }
  return { build, rulesLine, rowTexts, lapsHtml };
})();
