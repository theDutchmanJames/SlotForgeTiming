// database: the editable tables of the system forms: penalties, damage levels, failures, tyres, push and save, weather
// (part of renderer/database.js: loaded just before it by index.html; the parts share the page's global scope)
// The modern penalty editor deliberately does not start with pre-filled penalties:
// every named button is an explicit rule chosen by the Race Director.
const PT_DEFAULTS = [];
const ptRows = types =>
  types.length
    ? `<div class="ptrow pthead muted"><span>Name</span><span>Adds points</span><span>Immediate result</span><span>Amount</span><span></span></div>` +
      types
        .map((t, i) =>
          t.effect === undefined
            ? `<div class="ptrow"><input type="text" data-pt="${i}" data-ptk="name" value="${esc(t.name)}" aria-label="Name" maxlength="40"><span class="muted">Legacy pit penalty</span><span class="muted">Costs ${esc(t.cost)} points</span><span class="muted">${esc(t.kind === 'drivethrough' ? 'Drivethrough' : `Stop ${t.seconds} s`)}</span><button type="button" class="btn ib" data-ptdel="${i}" aria-label="Remove ${esc(t.name || 'this special penalty')}" title="Remove">${Icons.svg('trash', { size: 16 })}</button></div>`
            : `<div class="ptrow"><input type="text" data-pt="${i}" data-ptk="name" value="${esc(t.name)}" aria-label="Name" maxlength="40">
  <input type="number" min="0" step="1" data-pt="${i}" data-ptk="points" value="${esc(t.points)}" aria-label="Penalty points to add">
  <select data-pt="${i}" data-ptk="effect" aria-label="Immediate result"><option value="none"${t.effect === 'none' ? ' selected' : ''}>No immediate result</option><option value="time"${t.effect === 'time' ? ' selected' : ''}>Add time</option><option value="laps"${t.effect === 'laps' ? ' selected' : ''}>Deduct scoring laps</option><option value="pit"${t.effect === 'pit' ? ' selected' : ''}>Force pit stop</option></select>
  <input type="number" min="0" step="any" data-pt="${i}" data-ptk="amount" value="${esc(t.amount)}" aria-label="Amount (seconds or scoring laps)" title="Seconds for time or a pit stop; scoring laps for a lap deduction."><button type="button" class="btn ib" data-ptdel="${i}" aria-label="Remove ${esc(t.name || 'this special penalty')}" title="Remove">${Icons.svg('trash', { size: 16 })}</button></div>`
        )
        .join('')
    : '<p class="muted">No special penalties yet. Add a named button for the Race Director when you need one.</p>';
const prRows = rules =>
  rules.length
    ? `<div class="ptrow prrow pthead muted"><span>From total points</span><span>Total time (s)</span><span>Scoring laps lost</span><span>Mandatory pit stop (s)</span><span></span></div>` +
      rules
        .map(
          (r, i) =>
            `<div class="ptrow prrow"><input type="number" min="1" step="1" data-pr="${i}" data-prk="from" value="${esc(r.from)}" aria-label="From total points"><input type="number" min="0" step="any" data-pr="${i}" data-prk="time" value="${esc(r.time)}" aria-label="Total time in seconds"><input type="number" min="0" step="1" data-pr="${i}" data-prk="laps" value="${esc(r.laps)}" aria-label="Scoring laps lost"><input type="number" min="0" step="any" data-pr="${i}" data-prk="pit" value="${esc(r.pit)}" aria-label="Mandatory pit stop seconds"><button type="button" class="btn ib" data-prdel="${i}" aria-label="Remove this level" title="Remove">${Icons.svg('trash', { size: 16 })}</button></div>`
        )
        .join('')
    : '<p class="muted">No point consequences yet. Penalty points are recorded, but do not change the result until you add a level.</p>';
// the levels of a damage system: one row each (a name, from how many damage points, how long to stand still, how urgent, the deadline in laps, what the stop does)
const dlRows = levels =>
  levels.length
    ? `<div class="ptrow dlrow pthead muted"><span>Name</span><span>From (damage points)</span><span>Stand still (s)</span><span>Pit</span><span>Within (laps, 0 = no deadline)</span><span>The stop</span><span></span></div>` +
      levels
        .map(
          (
            l,
            i
          ) => `<div class="ptrow dlrow"><input type="text" data-dl="${i}" data-dlk="name" value="${esc(l.name)}" aria-label="Name" maxlength="40">
  <input type="number" min="1" step="1" data-dl="${i}" data-dlk="from" value="${esc(l.from)}" aria-label="From how many damage points">
  <input type="number" min="0" step="any" data-dl="${i}" data-dlk="seconds" value="${esc(l.seconds)}" aria-label="Seconds to stand still on the sensor" title="How long the car must stand on the sensor in the pits. For a car that is retired or disqualified: how long before that happens (0 = as soon as the pit stop starts).">
  <select data-dl="${i}" data-dlk="urgency" aria-label="Pit whenever you can, or as fast as you can"><option value="whenever"${l.urgency !== 'asap' ? ' selected' : ''}>Whenever you can</option><option value="asap"${l.urgency === 'asap' ? ' selected' : ''}>As fast as you can</option></select>
  <input type="number" min="0" step="1" data-dl="${i}" data-dlk="within" value="${esc(l.within)}" aria-label="Laps within which the car must be in the pits" title="After this many laps the car gets penalty points for every lap (see Penalty points below). 0 = no deadline.">
  <select data-dl="${i}" data-dlk="action" aria-label="What the stop does"><option value="repair"${l.action !== 'retire' && l.action !== 'dq' ? ' selected' : ''}>Repairs the car</option><option value="retire"${l.action === 'retire' ? ' selected' : ''}>Retires the car</option><option value="dq"${l.action === 'dq' ? ' selected' : ''}>Disqualifies the car</option></select>
  <button type="button" class="btn ib" data-dldel="${i}" aria-label="Remove ${esc(l.name || 'this level')}" title="Remove">${Icons.svg('trash', { size: 16 })}</button></div>`
        )
        .join('')
    : '<p class="muted">No levels yet: damage points are counted, but no stop repairs or ends anything.</p>';
// the incidents of a damage system: a name and the damage points it gives (the buttons of the Race Director)
const diRows = incs =>
  incs.length
    ? `<div class="ptrow dirow pthead muted"><span>Name</span><span>Damage points</span><span></span></div>` +
      incs
        .map(
          (
            x,
            i
          ) => `<div class="ptrow dirow"><input type="text" data-di="${i}" data-dik="name" value="${esc(x.name)}" aria-label="Name" maxlength="40">
  <input type="number" min="1" step="1" data-di="${i}" data-dik="points" value="${esc(x.points)}" aria-label="Damage points it gives"><button type="button" class="btn ib" data-didel="${i}" aria-label="Remove ${esc(x.name || 'this incident')}" title="Remove">${Icons.svg('trash', { size: 16 })}</button></div>`
        )
        .join('')
    : '<p class="muted">No incidents yet: the Race Director then has only the plus and minus buttons.</p>';
// the Car Failures of a damage system (1.43.0): one row each (a name, the level whose rules it borrows, the chance in percent, the seconds to stand still)
const cfRows = (list, levels) =>
  list.length
    ? `<div class="ptrow cfrow pthead muted"><span>Name</span><span>Level (its rules)</span><span>Chance (%)</span><span>Stand still (s)</span><span></span></div>` +
      list
        .map((x, i) => {
          const names = levels.map(l => String(l.name || '').trim()).filter(Boolean),
            lost = String(x.level || '').trim() && !names.some(n => n.toLowerCase() === String(x.level).trim().toLowerCase());
          return `<div class="ptrow cfrow"><input type="text" data-cf="${i}" data-cfk="name" value="${esc(x.name)}" aria-label="Name" maxlength="40">
  <select data-cf="${i}" data-cfk="level" aria-label="The level whose rules the failure takes" title="The pit rules of this level (whenever you can or as fast as you can, the deadline in laps, and what the stop does: repair, retire or disqualify) are the rules of the failure."><option value="">None: pit whenever you can, no deadline, a repair</option>${names
    .map(
      n =>
        `<option value="${esc(n)}"${
          String(x.level || '')
            .trim()
            .toLowerCase() === n.toLowerCase()
            ? ' selected'
            : ''
        }>${esc(n)}</option>`
    )
    .join('')}${lost ? `<option value="${esc(x.level)}" selected>${esc(x.level)} (no such level)</option>` : ''}</select>
  <input type="number" min="0" max="100" step="any" data-cf="${i}" data-cfk="chance" value="${esc(x.chance)}" aria-label="Chance in percent that a car gets this failure in a race" title="The chance in percent that a car gets this failure at some point in the race (before the Failure factor of the slot car).">
  <input type="number" min="0" step="any" data-cf="${i}" data-cfk="seconds" value="${esc(x.seconds)}" aria-label="Seconds to stand still on the sensor" title="How long the car must stand on the sensor in the pits to clear the failure. For a failure that retires or disqualifies the car: how long before that happens (0 = as soon as the pit stop starts).">
  <button type="button" class="btn ib" data-cfdel="${i}" aria-label="Remove ${esc(x.name || 'this failure')}" title="Remove">${Icons.svg('trash', { size: 16 })}</button></div>`;
        })
        .join('') +
      (w => (w ? `<p class="warn" role="alert">${esc(w)}</p>` : ''))(Failures.lostText(list, levels))
    : '<p class="muted">No failures yet. Add the standard failures, or make your own.</p>';
// the tyres of a tyre wear system (field type 'tyretable'): setup starts with the useful
// answer (how long a set lasts at normal pace). The detailed grip profile remains available
// without making the primary setup look like four unrelated percentages per compound.
const twWearLabel = unit => (unit === 'distance' ? `Wear per 100 ${dUnit() === 'ft' ? 'ft' : 'm'} (%)` : 'Wear per lap (%)');
const twLifeLabel = unit => (unit === 'distance' ? (dUnit() === 'ft' ? 'ft' : 'm') : 'laps');
const twLife = (t, unit) => TyreWear.lifeForWear(unit, dUnit(), Number(String(t && t.wear !== undefined ? t.wear : '').replace(',', '.')));
const twLifeText = (t, unit) => {
  const n = twLife(t, unit);
  return n > 0 ? (Math.round(n * 10) / 10).toLocaleString() : 'Does not wear';
};
const twHead = unit =>
  `<div class="twrow twprimary twhead muted"><span>Tyre</span><span>Lasts about at normal pace</span><span>${twWearLabel(unit)} at normal pace</span><span></span></div>`;
const twIconLetter = ty => ((ty.icon || ty.code) === 'INT' ? 'I' : ty.icon || ty.code);
// Keep unfinished names visible while editing; saving still requires a nonblank name.
const twDraftTyres = tyres =>
  Object.fromEntries(
    Object.entries(tyres || {}).map(([k, v]) => [k, k.startsWith('C_') ? { ...v, name: String(v.name || '').trim() || 'Unnamed tyre' } : v])
  );
const twCustomFields = ty =>
  `<div class="twcustom formgrid"><label class="field">Name<input data-twmeta="${ty.code}" data-twkey="name" value="${esc(ty.name)}" maxlength="60" required></label><label class="field">Icon and colour<select data-twmeta="${ty.code}" data-twkey="icon">${Wx.TYRES.map(t => `<option value="${t.code}"${t.code === ty.icon ? ' selected' : ''}>${esc(t.name)} (${t.code})</option>`).join('')}</select></label><label class="field">Weather category<select data-twmeta="${ty.code}" data-twkey="cls">${[
    ['dry', 'Dry / slick'],
    ['inter', 'Intermediate'],
    ['wet', 'Wet']
  ]
    .map(([v, n]) => `<option value="${v}"${v === ty.cls ? ' selected' : ''}>${n}</option>`)
    .join(
      ''
    )}</select></label><div class="field"><button type="button" class="btn danger" data-twremove="${ty.code}">Remove custom tyre</button></div><p class="muted full">Icon controls appearance. Weather category controls weather effects and mandatory compound rules. Choose this tyre in Race Director → Tyre Change.</p></div>`;
const twRows = (tyres, unit, sel) =>
  Wx.withTyres(twDraftTyres(tyres))
    .TYRES.map(ty => {
      const t = tyres[ty.code] || {},
        c = ty.color;
      const life = twLife(t, unit);
      return `<div class="twrow twprimary${ty.code === sel ? ' sel' : ''}" data-twrow="${ty.code}"><span class="twname"><b class="twchip" style="border-color:${c};color:${c}">${esc(twIconLetter(ty))}</b> ${esc(ty.name)}</span>
    <label class="twf"><small>Lasts about at normal pace</small><span class="twlifeinput"><input type="number" step="0.1" min="0" data-twlife="${ty.code}" value="${esc(life > 0 ? Math.round(life * 10) / 10 : '')}" aria-label="${esc(ty.name)}: lasts about at normal pace"><em>${twLifeLabel(unit)}</em></span></label>
    <span class="twlasts" data-twwear="${ty.code}">${esc(twWearLabel(unit) + ': ' + (Number(t.wear) > 0 ? Number(t.wear).toLocaleString() + '%' : 'no wear'))}</span>
    <button type="button" class="btn small" data-twsel="${ty.code}" aria-label="Open Tyre Performance for ${esc(ty.name)}">Tyre Performance</button></div>${ty.custom ? twCustomFields({ ...ty, name: t.name ?? ty.name }) : ''}`;
    })
    .join('');
const twCurve = (tyres, sel) => {
  const ty = Wx.withTyres(twDraftTyres(tyres)).tyreOf(sel) || Wx.TYRES[0],
    t = TyreWear.cleanTyres(twDraftTyres(tyres))[ty.code];
  return `<div class="twcurve"><div class="twsvg">${TyreWear.curveSvg(t)}</div><div class="twtext"><p><strong>${esc(ty.name)}.</strong> New tyres give the fresh bonus (${TyreWear.effectText(t.bonus)}). The bonus fades while the tyre wears.</p>
    <p>${t.cliff > 0 ? `<strong>At ${t.cliff}% life left</strong> the bonus reaches zero. Below that, hindrance gradually increases.` : '<strong>With the threshold at 0%</strong> the bonus fades until the tyre is empty, then the full hindrance applies.'}</p><p><strong>At 0%</strong> the hindrance is at its worst (${TyreWear.effectText(-t.hind)}).</p>
    <p class="muted">Above zero on the graph means a bonus; below zero means hindrance. Only the fuel effects you enable are applied.</p></div></div>`;
};
const twProfile = (tyres, unit, sel) => {
  const ty = Wx.withTyres(twDraftTyres(tyres)).tyreOf(sel) || Wx.TYRES[0],
    t = tyres[ty.code] || {};
  return (
    `<details class="twadvanced"><summary>Tyre Performance — ${esc(ty.name)} <span class="muted">(optional)</span></summary><p>Choose how this tyre helps or hinders the car as its remaining life falls from 100% to 0%. The graph updates as you change the three values below.</p><p class="muted">A bonus can reduce fuel use, speed up refuelling or increase tank capacity; hindrance does the reverse. This needs an active Fuel System and the effects enabled under <strong>What worn tyres do</strong>, where you choose which fuel settings are affected.</p><p class="muted">To change tyre lifespan, use <strong>Lasts about</strong> in the tyre table. Tyre Performance does not change measured lap times or physical track power.</p><div class="twrow twprofile"><span class="twname"><b class="twchip" style="border-color:${ty.color};color:${ty.color}">${esc(twIconLetter(ty))}</b> ${esc(ty.name)}</span>` +
    TyreWear.NUMS.filter(([k]) => k !== 'wear')
      .map(
        ([k, label]) =>
          `<label class="twf"><small>${esc(label)}</small><input type="number" step="any" min="${TyreWear.LIMITS[k][0]}" max="${TyreWear.LIMITS[k][1]}" data-tw="${ty.code}" data-twk="${k}" value="${esc(t[k] ?? '')}" aria-label="${esc(ty.name)}: ${esc(label)}"></label>`
      )
      .join('') +
    `</div><div id="tw-curve">${twCurve(tyres, sel)}</div></details>`
  );
};
const twTable = (
  tyres,
  unit,
  sel
) => `<div class="twbtns row"><span class="twbl"><b>Start from a ready-made system</b><span class="muted">You can change every number.</span></span><span class="twseg" role="group" aria-label="Ready-made systems">${TyreWear.PRESET_KEYS.map(
  k => {
    const on = TyreWear.presetOf(tyres) === k;
    return `<button type="button" class="btn${on ? ' on' : ''}" aria-pressed="${on}" data-twpreset="${k}" title="${esc(TyreWear.PRESETS[k].note)}">${esc(TyreWear.PRESETS[k].name)}</button>`;
  }
).join('')}</span></div>
  <p class="muted">Set the life you want at normal pace, before weather, temperature and Push &amp; Save modifiers. Standard is in between, Sprint wears quickly (short races, many stops), and Endurance wears slowly.</p>
  <div class="twtable" id="tw-table">${twHead(unit)}${twRows(tyres, unit, sel)}</div><p><button type="button" class="btn" data-twadd="1"${Object.keys(tyres).filter(k => k.startsWith('C_')).length >= 32 ? ' disabled' : ''}>Add custom tyre</button></p>${twProfile(tyres, unit, sel)}`;
// the ready-made push and save systems (field type 'pspresets', 1.54.0): a button for each that fills in the four wear numbers
const psNote = k => {
  const n = PushSave.PRESETS[k].note;
  return /[.!?]$/.test(n) ? n : n + '.';
};
const psPresets = key =>
  `<div class="fu-cards" role="group" aria-label="Ready-made systems">${PushSave.PRESET_KEYS.map(k => {
    const on = key === k;
    return `<button type="button" class="fu-card${on ? ' on' : ''}" aria-pressed="${on}" data-pspreset="${k}"><span class="fu-ct"><b>${esc(PushSave.PRESETS[k].name)}</b></span><span class="fu-cd">${esc(psNote(k))}</span><span class="fu-ck" aria-hidden="true">${Icons.svg('check', { size: 18, stroke: 1.8 })}</span></button>`;
  }).join('')}</div>`; // (1.76.0: cards, as in the design; the one whose four numbers the form holds is marked)
// Native range controls keep the Pace markers genuinely draggable (mouse, touch and keyboard).
const psCurveNumber = (v, d) => {
  const n = Number(String(v === undefined || v === null ? '' : v).replace(',', '.'));
  return Number.isFinite(n) ? Math.max(0.1, Math.min(100, n)) : d;
};
const psCurveData = get => {
  const push = Math.min(50, psCurveNumber(get('pushAt'), PushSave.DEFAULTS.pushAt)),
    save = psCurveNumber(get('saveAt'), PushSave.DEFAULTS.saveAt),
    tr = (state.refs.tracks || []).find(x => x.id === get('previewTrack')),
    target = Number(tr && tr.targetLap) > 0 ? Number(tr.targetLap) * 1000 : 0;
  const time = pct => (target ? `${((target * (1 + pct / 100)) / 1000).toFixed(3)} s` : `${pct < 0 ? '' : '+'}${pct}%`);
  return { push, save, target, time };
};
const psCurve = get => {
  if (get('mode') === 'legacy')
    return '<div class="pscurve legacy"><b>Best-lap reference</b><span class="muted">This saved system keeps its earlier pace model. Choose the driver pace benchmark model to use App Settings > Calculations.</span></div>';
  const { push, save, target, time } = psCurveData(get);
  return `<div class="pscurve" id="ps-curve"><div class="pscurve-labels"><span>Faster</span><strong>${esc(time(-push))}</strong><b>${esc(target ? time(0) : 'Driver benchmark')}</b><strong>${esc(time(save))}</strong><span>Slower</span></div><div class="pscurve-track"><i class="pscurve-fast"></i><i class="pscurve-mid"></i><i class="pscurve-save"></i><input type="range" min="0.1" max="50" step="0.1" value="${push}" data-pscurve="pushAt" aria-label="Full push: percent faster than the benchmark"><input type="range" min="0.1" max="100" step="0.1" value="${save}" data-pscurve="saveAt" aria-label="Full save: percent slower than the benchmark"></div><p><b>Full push</b> at ${esc(time(-push))} · the App Settings <b>benchmark</b> is normal use and wear · <b>full save</b> at ${esc(time(save))}. Drag either marker or type the exact value below.</p></div>`;
};
// the weather table of a tyre wear system (field type 'wxmult'): how much more or less every kind of tyre wears in every weather
const twWeatherGraph = mult => {
  const n = (state, kind) => {
    const v = Number(mult && mult[state] && mult[state][kind]);
    return Number.isFinite(v) ? Math.max(0, Math.min(20, v)) : 1;
  };
  const all = Wx.CLASSES.flatMap(kind => Wx.STATES.map(([state]) => n(state, kind))),
    hi = Math.max(2, ...all),
    w = 540,
    h = 180,
    l = 38,
    r = 12,
    top = 18,
    bottom = 30;
  const point = (v, i) => `${l + (i * (w - l - r)) / (Wx.STATES.length - 1)},${top + ((hi - v) * (h - top - bottom)) / hi}`;
  const line = (kind, color, label) =>
    `<polyline fill="none" stroke="${color}" stroke-width="3" points="${Wx.STATES.map(([state], i) => point(n(state, kind), i)).join(' ')}"/><text x="${l + 6}" y="${top + (kind === 'dry' ? 14 : kind === 'inter' ? 30 : 46)}" fill="${color}" font-size="12" font-weight="700">${label}</text>`;
  return `<div class="twweathercurve"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Tyre wear multiplier by weather: lower preserves a tyre and higher wears it faster"><line x1="${l}" x2="${w - r}" y1="${top + ((hi - 1) * (h - top - bottom)) / hi}" y2="${top + ((hi - 1) * (h - top - bottom)) / hi}" stroke="currentColor" opacity=".35" stroke-dasharray="4 4"/>${line('dry', '#f0b400', 'Dry tyres')}${line('inter', '#59be84', 'Intermediate')}${line('wet', '#54a7ec', 'Wet')}${Wx.STATES.map(([state, name], i) => `<text x="${l + (i * (w - l - r)) / (Wx.STATES.length - 1)}" y="${h - 9}" text-anchor="middle" fill="currentColor" opacity=".72" font-size="11">${esc(name)}</text>`).join('')}<text x="4" y="${top + 4}" fill="currentColor" opacity=".72" font-size="11">${hi}&times;</text><text x="8" y="${top + ((hi - 1) * (h - top - bottom)) / hi + 4}" fill="currentColor" opacity=".72" font-size="11">1&times;</text></svg><p class="muted">The dashed line is normal wear (1.0×). A line below it preserves a tyre; a line above it wears the tyre faster. The right tyre for the conditions follows the lower line.</p></div>`;
};
const twMult = mult =>
  `<div class="twtable twmult"><div class="twrow twhead muted"><span>Weather</span><span>Dry tyres (Hard, Medium, Soft, Supersoft)</span><span>Intermediate</span><span>Wet</span></div>` +
  Wx.STATES.map(
    ([st, name]) =>
      `<div class="twrow"><span class="twname"><strong>${esc(name)}</strong></span>` +
      Wx.CLASSES.map(
        c =>
          `<label class="twx"><small>${c === 'dry' ? 'Dry tyres' : c === 'inter' ? 'Intermediate' : 'Wet'}</small><input type="number" step="any" min="0" max="20" data-twm="${st}" data-twmc="${c}" value="${esc(mult[st] && mult[st][c] !== undefined ? mult[st][c] : '')}" aria-label="${esc(name)} weather, ${c === 'dry' ? 'dry' : c === 'inter' ? 'Intermediate' : 'Wet'} tyres: times the wear"><span>&times;</span></label>`
      ).join('') +
      '</div>'
  ).join('') +
  '</div>' +
  twWeatherGraph(mult) +
  `  <p class="muted">The numbers multiply the wear above: 1.0 is normal, 0.5 is half the wear, 3.0 is three times. Intermediate and Wet tyres wear slower in the rain and slicks wear faster on a wet track. Only used in a race with a Weather System.</p>`;
// the sets of a tyre wear system (field type 'tyresets'): how many sets of every tyre a car, or a team, has (1.41.0)
const twSets = (sets, tyres) =>
  `<div class="twtable twsets" id="tw-sets">` +
  TyreWear.withTyres(tyres)
    .CODES.map(code => {
      const ty = Wx.withTyres(tyres).tyreOf(code),
        c = ty.color;
      return `<label class="twx twsetx"><small><b class="twchip" style="border-color:${c};color:${c}">${esc(twIconLetter(ty))}</b> ${esc(ty.name)}</small><input type="number" step="1" min="0" max="99" data-tws="${code}" value="${esc(sets && sets[code] !== undefined ? sets[code] : '')}" aria-label="Sets of ${esc(ty.name)} tyres"></label>`;
    })
    .join('') +
  `</div>`;
const calcRows = pieces =>
  pieces
    .map(
      (
        p,
        i
      ) => `<div class="calcrow"><input type="number" min="0" step="1" class="calc-count" data-i="${i}" value="${esc(p.count)}" aria-label="Number of pieces"> &times;
  <input type="number" min="0" step="any" class="calc-mm" data-i="${i}" value="${esc(Speed.smallTyped(p.mm, dUnit()))}" aria-label="Length of one piece in ${dUnit() === 'ft' ? 'inches' : 'millimetres'}"> ${dUnit() === 'ft' ? 'in' : 'mm'} <button type="button" class="btn" data-calcdel="${i}">Remove</button></div>`
    )
    .join('');
const calcHtml =
  pieces => `<p class="muted">Number of pieces &times; length of one piece. Add a row for every kind of piece.</p><div id="calc-rows">${calcRows(pieces)}</div>
  <div class="row"><button type="button" class="btn" data-calcadd="1">Add another piece type</button> <strong id="calc-total">${Speed.lengthText(Speed.lengthFromPieces(pieces), dUnit())}</strong>
  <button type="button" class="btn primary" data-calcuse="1">Use this length</button></div>`;

// The weather system (1.74.0): the bar of the weather over the race (field type 'wxtimeline': the sentence code draws the bar into rs-strip), the table of how much the wrong tyres hinder a car (type 'wxhinder', 12 numbers)
// and the table of the conditions on the track (type 'wxcond', 16 numbers). The numbers are ordinary settings (ui 'cell', ids f-<setting>) that the table draws, so the form reads and saves them as before.
const BAR_TYPES = ['wxtimeline', 'pstimeline', 'sctimeline']; // (a bar that the form draws from the numbers: the weather over the race, the pace of a lap, the part of the race where a flag can come; none of them is a setting)
const wxTyreName = c => (c === 'dry' ? 'Dry tyres' : c === 'inter' ? 'Intermediate' : 'Wet');
// Weather has four discrete states, so a heat map says more than a pretend line
// chart: every cell is both the editable rule and a proportional visual bar.
const wxHinderNumber = (v, fallback = 0) => {
  const raw = String(v === undefined || v === null ? '' : v).trim();
  if (!raw) return fallback;
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) ? Math.max(0, Math.min(Wx.MAXP, n)) : fallback;
};
// An older saved Weather System can omit these fields. Its engine still uses the
// standard table, so the map must visualise those effective values, not twelve
// misleading zeroes in otherwise blank legacy boxes.
const wxHinderValue = (get, state, cls) => {
  const key = Wx.HKEYS[state + '/' + cls];
  return wxHinderNumber(get(key), Wx.DEFAULTS[key]);
};
const wxHinderPresetOf = get =>
  (Wx.HINDER_PRESET_KEYS || []).find(id => {
    const table = Wx.HINDER_PRESETS[id].table;
    return Wx.STATES.every(([state]) => Wx.CLASSES.every(cls => wxHinderValue(get, state, cls) === table[state][cls]));
  }) || '';
const wxHinderPreview = (get, focus) => {
  const state = focus && Wx.STATES.some(x => x[0] === focus.state) ? focus.state : 'wet';
  const cls = focus && Wx.CLASSES.includes(focus.cls) ? focus.cls : 'dry';
  const pct = wxHinderValue(get, state, cls),
    factor = n => (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, '');
  const effects = [];
  if (get('hUse') !== 'off') effects.push(`<span><b>${pct}%</b> more fuel per lap <small>×${factor(1 + pct / 100)}</small></span>`);
  if (get('hRate') !== 'off') effects.push(`<span><b>${pct}%</b> slower refuelling <small>×${factor(1 - pct / 100)}</small></span>`);
  if (get('hTank') === 'on') effects.push(`<span><b>${pct}%</b> smaller tank <small>×${factor(1 - pct / 100)}</small></span>`);
  return `<div class="wxhpreview-head"><span class="wxhstate wx-${state}">${esc(Wx.stateName(state))}</span><b>${esc(wxTyreName(cls))}</b><strong>${pct}% fuel handicap</strong></div>
    <div class="wxhpreview-effects">${effects.length ? effects.join('') : '<span>No fuel effect is enabled.</span>'}</div>
    <p>It changes fuel strategy, never the measured lap time. Weather, Balance of Power and Tyre Wear add per enabled effect, up to 90%.</p>`;
};
const wxHinderMap = (get, focus) => {
  const preset = wxHinderPresetOf(get);
  const profiles = (Wx.HINDER_PRESET_KEYS || [])
    .map(id => {
      const p = Wx.HINDER_PRESETS[id],
        on = preset === id;
      return `<button type="button" class="btn small${on ? ' on' : ''}" aria-pressed="${on}" data-wxhprofile="${id}" title="${esc(p.note)}">${esc(p.name)}</button>`;
    })
    .join('');
  const table =
    `<div class="wxtab wxhmap"><div class="wxrow wxhead muted"><span>Weather</span>${Wx.CLASSES.map(c => `<span>${wxTyreName(c)}<small>fuel handicap</small></span>`).join('')}</div>` +
    Wx.STATES.map(
      ([state, name]) =>
        `<div class="wxrow"><span class="wxname wxhstate wx-${state}">${esc(name)}</span>${Wx.CLASSES.map(cls => {
          const key = Wx.HKEYS[state + '/' + cls],
            pct = wxHinderValue(get, state, cls),
            selected = focus && focus.state === state && focus.cls === cls;
          return `<label class="wxcell wxhcell${selected ? ' selected' : ''}" data-wxhcell="1" data-wxhstate="${state}" data-wxhclass="${cls}" style="--wxh:${pct}%"><span class="wxhbar" aria-hidden="true"><i></i></span><span class="wxhinput"><input class="wxin" id="f-${key}" data-wxh="1" type="number" step="any" min="0" max="${Wx.MAXP}" value="${esc(get(key))}" aria-label="${esc(name)} weather, ${esc(wxTyreName(cls).toLowerCase())}, percent fuel handicap"><b>%</b></span></label>`;
        }).join('')}</div>`
    ).join('') +
    `</div>`;
  return `<div class="wxhprofiles"><span><b>Start from a profile</b><small>You can still tune every cell.</small></span><div role="group" aria-label="Wrong-tyre fuel handicap profiles">${profiles}</div></div>${table}
    <div class="wxhpreview" id="wx-hinder-preview">${wxHinderPreview(get, focus)}</div>
    <p class="muted hint">The percentage is a fuel handicap for that tyre in that weather: 0 means no handicap; the combined effect never exceeds ${Wx.MAXP}%.</p>`;
};
const wxCondTable = (vals, words) => {
  // the heading of a column, with the units (they follow the choice of units: data-condunit); on a narrow screen the heading row is hidden and every number has its own small heading (wxcl)
  const heads = {
    track: `Track temperature (<span data-condunit="temp">${esc(words.temp)}</span>)`,
    air: `Air temperature (<span data-condunit="temp">${esc(words.temp)}</span>)`,
    wind: `Wind speed (<span data-condunit="speed">${esc(words.speed)}</span>)`,
    dir: 'Wind from (degrees)'
  };
  return (
    `<div class="wxtab wxcond"><div class="wxrow wxhead muted"><span>Weather</span>${Wx.COND_ITEMS.map(([item]) => `<span>${heads[item]}</span>`).join('')}</div>` +
    Wx.STATES.map(
      ([st, name]) =>
        `<div class="wxrow"><span class="wxname">${esc(name)}</span>${Wx.COND_ITEMS.map(([item, , itemName]) => {
          const k = Wx.CKEYS[st + '/' + item];
          return `<label class="wxcell"><small class="wxcl">${heads[item]}</small><input class="wxin" id="f-${k}" type="number" step="any"${item === 'wind' ? ' min="0"' : item === 'dir' ? ' min="0" max="359"' : ''} value="${esc(vals(k))}" aria-label="${esc(name)}: ${esc(itemName.toLowerCase())}"></label>`;
        }).join('')}</div>`
    ).join('') +
    `</div><p class="muted hint">Where the wind comes from: 0 is north, 90 east, 180 south, 270 west.</p>`
  );
};

// the drivers of a team (field type 'members'): in the order they take their turn, with a list to add one more from
const memRows = (ids, all) => `<ol class="memlist">${
  ids.length
    ? ids
        .map((id, i) => {
          const d = all.find(x => x.id === id);
          return `<li><span class="memname">${esc(d ? titleOf('drivers', d) : '(deleted)')}</span> <button type="button" class="btn" data-memup="${i}" aria-label="Move up"${i ? '' : ' disabled'}>&uarr;</button><button type="button" class="btn" data-memdown="${i}" aria-label="Move down"${i < ids.length - 1 ? '' : ' disabled'}>&darr;</button><button type="button" class="btn danger" data-memdel="${i}">Remove</button></li>`;
        })
        .join('')
    : '<li class="muted">No drivers in this team yet.</li>'
}</ol>
  <div class="row"><select id="mem-pick" aria-label="Driver to add"><option value="">${all.some(d => !ids.includes(d.id)) ? 'Choose a driver…' : 'Every driver is in the team'}</option>${all
    .filter(d => !ids.includes(d.id))
    .map(d => `<option value="${esc(d.id)}">${esc(titleOf('drivers', d))}</option>`)
    .join('')}</select> <button type="button" class="btn" data-memadd="1">Add to the team</button></div>`;
