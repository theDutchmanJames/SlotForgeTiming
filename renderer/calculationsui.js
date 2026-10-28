// Calculations uses the same saved systems and pure rules as race preparation.
// Example inputs are local to this page; only labelled Save controls persist rules.
const CalculationPage = (() => {
  let active = 'pace', selected = {}, example = { laps: '10, 10.2, 9.8, 12', lap: 9.5, target: 10 };
  const sections = [
    ['pace', 'Pace benchmarks', 'Push & Save · Tyre Wear', 'var(--c-ps)'],
    ['fuel', 'Fuel & tyres', 'Consumption · grip · stacking', 'var(--c-fuel)'],
    ['effects', 'Race effects', 'Balance of Power · weather · damage', 'var(--c-wx)'],
    ['resources','Resource allocation','Tyre sets · repairs · components','#56bfaa'],
    ['pits', 'Pit service & penalties', 'Service order · timers · consequences', 'var(--c-pen)'],
    ['estimates', 'Estimates & timing', 'Range · distance · gaps', 'var(--c-tok)'],
    ['results', 'Results & scoring', 'Eligible laps · heats · championships', 'var(--c-ch)']
  ];
  const entities = ['fuelrules', 'tyrewearsystems', 'pushsavesystems', 'weathersystems', 'damagesystems', 'safetycarsystems', 'penaltysystems', 'racesetups', 'championships', 'rotationsetups', 'tracks'];
  const formula = (title, equation, text, worked) => `<article class="calc-equation"><h4>${esc(title)}</h4><code>${esc(equation)}</code><p>${esc(text)}</p>${worked ? `<p class="calc-worked"><b>Example</b> ${esc(worked)}</p>` : ''}</article>`;
  const input = (key, label, value, max = 1000) => `<label>${esc(label)}<input type="number" data-policy="${key}" min="0" max="${max}" step="1" value="${value}" required></label>`;
  const methods = current => PushSave.BENCHMARKS.map(([key, title]) => `<option value="${key}"${current === key ? ' selected' : ''}>${esc(title.replace('recent valid', 'eligible').replace('in this race', 'in the selected history'))}</option>`).join('');
  const routeButton = (tab, sub, text) => `<button type="button" class="btn" data-calc-route="${tab}" data-sub="${sub}">${esc(text)}</button>`;
  function policyCard(prefix, title, color) {
    const p = PushSave.policyFromSettings(state.settings, prefix);
    return `<form class="calc-policy" data-prefix="${prefix}" style="--calc-accent:${color}"><h4>${title}</h4><p>${prefix === 'tyreWear' ? 'Used when Pace-sensitive wear is enabled in the chosen Tyre Wear System.' : 'Used by the current Push & Save model. Legacy systems retain their original reference rules.'}</p><div class="calc-fields"><label>Benchmark<select data-policy="Benchmark">${methods(p.benchmark)}</select></label>${input('Window', 'Recent eligible laps · 0 = all', p.pacePolicy.window)}${input('Minimum', 'Minimum samples · 0 = automatic', p.pacePolicy.minimum)}</div><p class="muted">Automatic: median / average need 3 samples; previous / best need 1. Track target needs no history. The current lap is compared with earlier laps, never with itself.</p><output data-preview="${prefix}" class="calc-preview"></output><button class="btn" type="submit">Save ${title} calculation</button><span class="calc-save" role="status"></span></form>`;
  }
  function recordControl(e, refs, fields = []) {
    const rows = refs[e] || [], current = rows.find(r => r.id === selected[e]) || rows[0];
    if (current) selected[e] = current.id;
    const schema = state.schema[e];
    if (!schema) return '';
    if (e === 'pushsavesystems' && current && current.mode !== 'median') fields = ['normal', ...fields.filter(k => k !== 'pushAt')];
    const inline = current ? fields.map(key => {
      const f = schema.fields.find(f => f.key === key);
      if (!f || f.type !== 'number') return '';
      return `<label>${esc(f.label)}${f.suffix ? ` (${esc(f.suffix)})` : ''}<input type="number" min="${f.min ?? 0}"${f.max !== undefined ? ` max="${f.max}"` : ''} step="any" data-record-field="${key}" value="${esc(current[key] ?? f.default ?? 0)}" required></label>`;
    }).join('') : '';
    return `<section class="calc-record" data-entity="${e}"><label>${esc(schema.label)}<select data-record-select${rows.length ? '' : ' disabled'}>${rows.length ? rows.map(r => `<option value="${esc(r.id)}"${r.id === current.id ? ' selected' : ''}>${esc(titleOf(e, r))}</option>`).join('') : '<option>No saved systems yet</option>'}</select></label>${inline ? `<form class="calc-record-form"><div class="calc-fields">${inline}</div><button class="btn">Save system values</button><span role="status" class="calc-save"></span></form>` : ''}<div class="calc-actions"><button class="btn" type="button" data-edit-record${current ? '' : ' disabled'}>Edit all ${esc(schema.label.toLowerCase())} rules</button><button class="btn" type="button" data-new-record>Create ${esc(schema.label.toLowerCase())}</button></div><p class="muted">These are the original saved settings. Changes also appear in Race Setup and apply to new races that use this system.</p></section>`;
  }
  function content(refs) {
    if(active==='resources')return `${formula('Resource balance','remaining = initial allocation + director adjustments − completed services','Each driver, slotcar or team has its own account. Event accounts span heats; championship accounts span loaded championship sessions. Points awards and result deletion do not change balances. Editing a profile does not refill existing accounts.','Three tyre sets − one starting set − one completed tyre change = one unused set.')}${formula('Service cost','tyre change = 1 set of the fitted compound\ndamage repair = 1 repair credit\nfailure repair = 1 repair credit + 1 replacement component','Each limit applies only when enabled. Failure repair reserves both supplies together. Insufficient supplies leave work undone, without charging a partial cost. Starting sets count; abandoned work and penalties consume no repair credits.','Damage plus failure repaired in one stop: two repair credits and one component when both limits are on.')}${routeButton('setup','resources','Edit Resource Systems')}`;
    if (active === 'pace') return `<p class="calc-intro">Choose each system’s reference independently. Eligible history excludes pit, slow, red-interrupted and full yellow laps. Removing or invalidating a lap rebuilds future references; it does not refund fuel or wear already used.</p>
      <section class="calc-example"><h4>Try a lap sequence</h4><div class="calc-fields"><label>Earlier eligible laps · seconds, separated by commas<input data-example="laps" value="${esc(example.laps)}"></label><label>New lap · seconds<input data-example="lap" type="number" min="0.001" step="0.001" value="${example.lap}"></label><label>Track target · seconds<input data-example="target" type="number" min="0" step="0.001" value="${example.target}"></label></div><p class="muted">Preview only. In a race, Track target comes from the active track in the Database.</p></section>
      ${policyCard('pushSave', 'Push & Save', 'var(--c-ps)')}${policyCard('tyreWear', 'Tyre Wear', 'var(--c-tyre)')}
      ${formula('Pace difference', '(lap ÷ reference − 1) × 100%', 'A negative difference is faster; a positive difference is slower. No available reference means normal use and wear.', '9.5 s against 10 s = −5%: pushing.')}
      ${formula('Push & Save curve', 'push: 1 + extra × min(1, −pace ÷ push threshold)\nsave: 1 − saving × min(1, pace ÷ save threshold)', 'Extra and saving are fractions. Fuel and tyres have their own switches and amounts. Early laps and excluded laps have no normal pace effect; the yellow-save option is a separate rule.', 'At −1.5%, with full push at −3% and +40% tyre wear, tyre multiplier = 1.20.')}
      ${recordControl('pushsavesystems', refs, ['pushAt', 'saveAt', 'tyreExtra', 'tyreSave', 'fuelExtra', 'fuelSave'])}
      ${formula('Tyre pace multiplier', 'clamp(1 + (reference ÷ lap − 1) × strength, 0.5, 1.5)', 'Strength is 0.5 gentle, 1 normal or 1.5 strong. It applies independently of Push & Save; enabling both multiplies both effects.', '10 s reference / 8 s lap at normal strength = 1.25 × base wear.')}${recordControl('tyrewearsystems', refs)}`;
    if (active === 'fuel') return `${recordControl('fuelrules', refs, ['tank', 'perLap', 'rate'])}<div id="calc-fuel-example"></div>
      ${formula('Fuel consumption', 'litres used = base litres per lap × combined use factor × Push & Save fuel factor', 'Without Push & Save, older Fuel Systems may still use their legacy target-lap curve. New Fuel Systems use their fixed per-lap amount. Damage is not part of the combined fuel multiplier.', '2 L × 1.20 hindrance × 1.25 push = 3 L per lap.')}
      ${formula('Combined fuel effects', 'signed effect = clamp(sum of enabled source percentages, −90, +90)\nuse = 1 − effect / 100; rate and tank = 1 + effect / 100', 'Balance of Power, weather and tyre grip add independently for each enabled lever. Positive helps; negative hinders. The tank lever applies only when enabled. They do not change measured lap times.', '−20% weather + 10% tyre help = −10%: 1.10 × fuel use; 0.90 × refuel rate if both levers are enabled.')}
      ${formula('Tyre life used', 'wear = compound wear × weather multiplier × distance factor × tyre pace × Push & Save tyres × temperature', 'Distance factor is 1 per lap, or lane length divided by 100 m / 100 ft for distance-based wear. Life is clamped to 0–100%.', '2% × 1.5 weather × 1.25 pace × 1.20 push = 4.5 percentage points of life.')}
      ${formula('Simulated tyre temperature', 'target = working midpoint + pace offset + 0.5 × (ambient now − dry ambient)\npace offset: intensity × 0.75 × range width; intensity scales from −1 at full Save to +1 at full Push\nnew temperature = move toward target by at most warm-up degrees per eligible lap\ncooling = move toward ambient by cooling degrees/minute × elapsed minutes', 'Temperature is optional in Tyre Wear. Weather mode uses air temperature converted to Celsius. Pits and yellow/red pauses cool. Recovery does not simulate offline time. Without eligible Push & Save data, the target is Normal.')}
      ${formula('Temperature wear multiplier', 'cold fraction = clamp((range low − T) ÷ (range low + 20), 0, 1)\nhot fraction = clamp((T − range high) ÷ (180 − range high), 0, 1)\nmultiplier = 1 + fraction × configured extra wear ÷ 100', 'Working-range temperatures have multiplier 1. The lap uses the mean temperature before/after its warming step; the widget shows the multiplier at the current temperature. Temperatures are bounded to −20…180 °C. Initial lifespan estimates assume multiplier 1.', 'With range 60–90 °C, T = 20 °C and 20% maximum cold wear: fraction 0.5 → wear ×1.10.')}
      ${formula('Fresh-tyre grip and the cliff', 'above cliff: bonus × (life − cliff) / (100 − cliff)\nbelow cliff: −hindrance × (cliff − life) / cliff', 'The curve meets zero at the cliff. The resulting percentage feeds the enabled fuel levers. Grip does not speed up the measured clock.', 'Bonus 10%, cliff 40%, life 70% → +5% help.')}${recordControl('tyrewearsystems', refs)}${recordControl('weathersystems', refs)}`;
    if (active === 'effects') return `${bopControls()}
      ${formula('Automatic Balance of Power', 'spread = slowest pace − fastest pace\nscaled strength = maximum × min(1, spread ÷ full-effect gap)', 'Pace uses the chosen average or median and history window. Lane correction divides pace by lane length / mean lane length. Apply and remove thresholds avoid rapid switching. Graded mode scales each car by its distance from the field midpoint.', 'With a 20% maximum, full effect at 1 s and a 0.5 s spread, scaled strength is 10%.')}
      ${formula('Weather handicap', 'selected condition + fitted tyre category → configured help / hindrance', 'The Weather System owns condition probabilities, durations, wrong-tyre penalties and the handicap table. Tyre Wear owns its separate weather-wear table. Custom tyres inherit their chosen weather category.')}${recordControl('weathersystems', refs)}
      ${formula('Damage and failures', 'damage points → highest reached level\nrepair work → configured duration for that level', 'Damage level, repair work and failure chance have their own tables and triggers. Failure checks use random draws at the configured checks; a percentage is a probability per check, not a promised number of failures.')}${recordControl('damagesystems', refs)}
      ${formula('Safety Car', 'too fast when full-yellow lap < configured target\nreduced pit work = normal work × (1 − reduction / 100)', 'Penalty points and pit reduction have independent switches. Track Call power behaviour comes from Race Setup. Random Flag conditions can hold pit exit or require a target pace; they do not rewrite the lap clock.')}${recordControl('safetycarsystems', refs)}`;
    if (active === 'pits') return `${formula('Normal service order', 'fuel finish = missing litres ÷ effective rate\nrepair finish = repair time + (sequential ? fuel finish : 0)\ntyre finish = tyre time + (sequential ? max(fuel finish, repair finish) : 0)', 'The longest completion time sets the normal service duration. Driver-swap and sensor rules can also prevent release.', 'Fuel 8 s, repair 12 s, tyres 10 s: all parallel → 12 s; both sequential → 30 s.')}
      ${formula('Fixed Service Stop override', 'scaled job finish = original job finish × fixed window / longest job\nrelease due = fixed window + penalty time', 'A fixed Service Stop compresses or stretches ordinary service into the selected window. Penalties are always additional. Manual release, return-to-sensor and a Random Flag pit hold can keep the car waiting after the timer.', '45 s of service fitted into 30 s, plus a 5 s penalty → at least 35 s.')}
      ${recordControl('racesetups', refs)}
      ${formula('Penalty points and tiers', 'per-point: consequence = points × amount\ntable: highest reached threshold supplies the consequence', 'A higher unserved pit tier replaces the lower tier. Completed pit penalties remain served; Special Penalties remain separate. Time and lap totals are recalculated from the current tier. Disqualification checks use the enabled thresholds.', 'Thresholds: 1 → nothing, 3 → 5 s, 5 → 10 s. Four points give 5 s; five give 10 s total.')}${recordControl('penaltysystems', refs)}${recordControl('damagesystems', refs)}${recordControl('tyrewearsystems', refs)}`;
    if (active === 'estimates') return `<div class="calc-actions">${routeButton('custom', 'layouts', 'Edit widget estimates in Layout Editor')}${routeButton('custom', 'charts', 'Edit chart calculations')}</div>${formula('Fuel Range widget', 'estimated laps left = remaining fuel ÷ average actual sampled use', 'The widget samples 3–20 recent clean laps and waits for at least 3. It includes effects actually applied on those laps. The sample count belongs to each widget in the Layout Editor.', '30 L remaining / 2.5 L average used = about 12 laps.')}
      ${formula('Tyre life estimate', 'laps left = remaining life ÷ base wear for current weather and lane', 'This is a base estimate. It does not predict future pace or future weather. The system’s “Lasts about” control sets base wear as 100 / desired lifetime.', '60% life / 2% per lap = about 30 laps; 800-lap base life means 0.125% wear.')}
      ${formula('Fractional-lap gap', 'lap gap ≈ engine time gap ÷ leader’s median eligible lap', 'Rounded to one decimal. Practice and qualifying continue to compare best times. Track length is not needed to convert a time gap into a fraction of a lap; distance racing has separate length-based estimates.', '2 s gap / 10 s median = +0.2 laps.')}
      ${formula('Speed, scale speed and distance', 'speed (km/h) = lane metres / lap seconds × 3.6\nscale speed = physical speed × scale factor\ndistance = sum of counted lane lengths', 'Feet, miles and other display units are conversions of stored metres. A missing lane length means a speed or distance estimate is unavailable.')}
      ${formula('Sensors, red flags and first crossing', 'minimum accepted interval = max(0.800 s, track minimum)\ninterrupted lap stays counted but is invalid for records', 'Race Setup controls formation-lap behaviour, red-flag restart and any optional interrupted-lap time addition. Pauses are excluded from the running clock. Sensor thresholds and pit confirmation are distinct from pace sampling.')}${recordControl('tracks', refs, ['targetLap', 'minLap', 'maxLap'])}${recordControl('racesetups', refs)}`;
    return `${formula('Average and median', 'average = sum of eligible lap times ÷ count\nmedian = middle sorted value (or mean of the two middle values)', 'Push & Save and Tyre Wear use the separate pace policies above. Charts have their own sampling options. Eligibility differs by purpose: a pit lap can count in a race result while being excluded from pace learning.')}
      ${formula('Consistency', 'consistency = √(sum of squared deviations ÷ number of eligible laps)', 'Results cards, database Statistics and generated reports use the same population standard deviation. At least two eligible laps are needed. Invalid, removed, slow and pit laps do not count; late token laps are invalid. Existing lap records stay unchanged; derived consistency is recalculated when displayed.', 'For 9 s and 11 s: mean = 10 s; consistency = 1 s on every screen.')}
      ${formula('Classification and records', 'adjusted time = measured race time + applicable time consequences\nclassification follows the selected session winner rule', 'Invalid laps remain in distance unless removed, but cannot set fastest laps, Personal Bests or Track Records. Removed laps do not count. Disqualified and retired participants follow the session classification rules. Practice and qualifying compare eligible best laps.')}
      ${formula('Multi-Class scoring', 'class position = rank among eligible entries in the same class\nclass points = class position table + eligible class bonuses\noverall points and class points are separate totals', 'Each class reuses the heat or championship rules for ties, dropped results, sprint shares and team allocation. Choose a table override in Race Setup > Multi-Class Systems.')}
      ${formula('Virtual Rival replay', 'replay lap = recorded lap × 100 ÷ replay speed (%)\nreplay progress = elapsed race clock', 'Pauses and red flags freeze replay. Invalid source laps are excluded; pit laps are optional. Replayed service time is not charged a second time. Change speed and sequence in Race Setup > Virtual Rival Systems.')}
      ${formula('Heat points', 'heat position → selected points table\naggregate = selected heat results under the heat scoring rule', 'Heat Setup controls which results count, tie ordering, finals and points. Race Results displays the points supplied by that competition; absent points are shown as unavailable, not invented as zero.')}${recordControl('racesetups', refs)}${recordControl('rotationsetups', refs)}
      ${formula('Championship points', 'session score = rounded share of position points and eligible bonuses\nstanding = sum of kept round scores', 'Sprint share and rounding, fastest-lap eligibility, pole and start bonuses, guest scoring, team contribution, dropped results and tie order are configured in the Championship. Dropped results remove the lowest scores, with earlier equal scores dropped first; at least one decided result remains.', 'Scores 10, 6, 8 with one dropped result → 18 points before other rounds.')}${recordControl('championships', refs)}
      ${formula('Time Tokens and endurance', 'token balance = purchased time − elapsed chargeable time', 'A token lane counts laps while paid time remains. Endurance tracks stint time or distance and applies configured missing-swap consequences. The corresponding setup editors retain these rules; normal fuel and tyre systems do not run in a Time Token session.')}${routeButton('setup', 'tokens', 'Edit Time Token rules')}`;
  }
  function bopControls() {
    const c = Bop.settingsOf(state.settings);
    return `<form class="calc-bop calc-policy"><h4>Balance of Power calculation</h4><div class="calc-fields"><label>Measure<select name="bopMeasure"><option value="median"${c.measure === 'median' ? ' selected' : ''}>Median</option><option value="average"${c.measure === 'average' ? ' selected' : ''}>Average</option></select></label><label>Recent laps<input name="bopWindow" type="number" min="3" max="50" value="${c.window}" required></label><label>Minimum laps<input name="bopMinLaps" type="number" min="1" max="50" value="${c.minLaps}" required></label></div><button class="btn">Save Balance of Power calculation</button><span class="calc-save" role="status"></span><p class="muted">Uses the same settings as the Balance of Power page.</p>${routeButton('setup', 'bop', 'Edit all Balance of Power rules')}</form>`;
  }
  async function render(box) {
    const rows = await Promise.all(entities.map(e => api.list(e))), refs = Object.fromEntries(entities.map((e, i) => [e, rows[i]]));
    if (!box.isConnected) return;
    Object.assign(state.refs, refs);
    const section = sections.find(s => s[0] === active);
    box.innerHTML = `<section class="calc-page calc-expanded setuppage"><header class="calc-head"><div><p class="eyebrow">SETTINGS FOR FUTURE RACES</p><h3>Calculations</h3><p>In plain words: choose how pace is measured, see what every racing system adds, and tune the original settings in one place.</p></div><aside><b>Predictable races</b><span>A running race keeps its starting rules. New results retain those rules for review.</span></aside></header><div class="calc-shell"><nav class="calc-rail" aria-label="Calculation sections">${sections.map(([id, title, note, color]) => `<button class="btn" type="button" data-calc-section="${id}" aria-current="${id === active ? 'page' : 'false'}" style="--calc-accent:${color}"><b>${title}</b><small>${note}</small></button>`).join('')}</nav><main class="calc-content" style="--calc-accent:${section[3]}"><header><p class="eyebrow">CALCULATION LIBRARY</p><h3>${section[1]}</h3></header>${content(refs)}</main></div></section>`;
    box.querySelectorAll('[data-calc-section]').forEach(b => b.onclick = () => { active = b.dataset.calcSection; render(box); });
    box.querySelectorAll('[data-calc-route]').forEach(b => b.onclick = () => {
      state.tab = b.dataset.calcRoute;
      if (state.tab === 'custom') state.customSub = b.dataset.sub; else state.setupSub = b.dataset.sub;
      window.render();
    });
    box.querySelectorAll('[data-example]').forEach(el => el.oninput = () => { example[el.dataset.example] = el.value; preview(box); });
    box.querySelectorAll('[data-prefix]').forEach(form => {
      form.oninput = () => preview(box);
      form.onsubmit = async ev => {
        ev.preventDefault(); const p = readPolicy(form), prefix = form.dataset.prefix;
        const automatic = ['median', 'average'].includes(p.benchmark) ? 3 : 1;
        if (p.benchmark !== 'track' && p.window && p.window < (p.minimum || automatic)) { form.querySelector('.calc-save').textContent = 'History must hold at least the required samples.'; return; }
        await save(form, () => api.setSettings({ [prefix + 'Benchmark']: p.benchmark, [prefix + 'Window']: p.window, [prefix + 'Minimum']: p.minimum }), true);
      };
    });
    const bop = box.querySelector('.calc-bop');
    if (bop) bop.onsubmit = async ev => { ev.preventDefault(); const data = Object.fromEntries(new FormData(bop)); if (+data.bopMinLaps > +data.bopWindow) { bop.querySelector('.calc-save').textContent = 'Minimum laps cannot exceed the history window.'; return; } data.bopWindow = +data.bopWindow; data.bopMinLaps = +data.bopMinLaps; await save(bop, () => api.setSettings(data), true); };
    box.querySelectorAll('[data-entity]').forEach(panel => {
      const e = panel.dataset.entity, row = refs[e].find(r => r.id === selected[e]);
      panel.querySelector('[data-record-select]').onchange = ev => { selected[e] = ev.target.value; render(box); };
      const edit = async item => {
        if (e === 'championships' || e === 'rotationsetups') {
          state.tab = 'setup'; state.setupSub = e === 'championships' ? 'championships' : 'rotation';
          await window.render();
          const host = document.getElementById('setupmgr');
          const button = item ? [...host.querySelectorAll('[data-edit]')].find(b => b.dataset.edit === item.id) : host.querySelector(e === 'championships' ? '#newch' : '#newrot');
          if (button) button.click();
          return;
        }
        openForm(e, item); dlg.addEventListener('close', () => { if (box.isConnected) render(box); }, { once: true }); };
      panel.querySelector('[data-edit-record]').onclick = () => edit(row);
      panel.querySelector('[data-new-record]').onclick = () => edit(null);
      const form = panel.querySelector('form');
      if (form) { form.oninput = () => fuelPreview(box); form.onsubmit = async ev => {
        ev.preventDefault(); if (!form.reportValidity()) return;
        const patch = Object.fromEntries([...form.querySelectorAll('[data-record-field]')].map(el => [el.dataset.recordField, Number(el.value)]));
        if (e === 'pushsavesystems' && row.mode !== 'median' && patch.saveAt <= patch.normal) { form.querySelector('.calc-save').textContent = 'Full save must be slower than normal pace.'; return; }
        await save(form, async () => { const result = await api.update(e, row.id, patch); Object.assign(row, patch); return result; });
      }; }
    });
    preview(box); fuelPreview(box);
  }
  async function save(form, write, settings = false) {
    const button = form.querySelector('button'), status = form.querySelector('.calc-save'); button.disabled = true;
    try { const result = await write(); if (settings) state.settings = result; status.textContent = 'Saved for new races'; }
    catch (e) { status.textContent = 'Could not save: ' + e.message; }
    finally { button.disabled = false; }
  }
  function readPolicy(form) {
    const value = key => form.querySelector(`[data-policy="${key}"]`).value;
    return { benchmark: value('Benchmark'), window: Number(value('Window')), minimum: Number(value('Minimum')) };
  }
  function preview(box) {
    const laps = String(example.laps).split(',').map(s => s.trim()).filter(Boolean).map(Number).filter(n => Number.isFinite(n) && n > 0).map(n => n * 1000);
    box.querySelectorAll('[data-prefix]').forEach(form => {
      const p = readPolicy(form), ref = PushSave.benchmark(p.benchmark, laps, Number(example.target) * 1000, p), lap = Number(example.lap) * 1000;
      const pace = ref > 0 && lap > 0 ? (lap / ref - 1) * 100 : null;
      const out = form.querySelector('output');
      const position = pace === null ? 50 : Math.max(2, Math.min(98, 50 + pace * 2));
      out.innerHTML = `<div class="calc-preview-numbers"><b>${ref ? (ref / 1000).toFixed(3) + ' s reference' : 'Waiting for reference'}</b><span>${pace === null ? 'Add enough eligible laps or a track target' : (pace > 0 ? '+' : '') + pace.toFixed(2) + '% · ' + (pace < 0 ? 'faster' : pace > 0 ? 'slower' : 'at benchmark')}</span></div><div class="calc-pace-bar" aria-hidden="true"><i style="left:${position}%"></i></div><div class="calc-bar-labels"><span>Faster</span><span>Benchmark</span><span>Slower</span></div>`;
    });
  }
  function fuelPreview(box) {
    const target = box.querySelector('#calc-fuel-example'), panel = box.querySelector('[data-entity="fuelrules"]'); if (!target || !panel) return;
    if (!panel.querySelector('[data-record-field]')) { target.textContent = 'Choose or create a Fuel System to preview its range and refuel duration.'; return; }
    const value = key => Number(panel.querySelector(`[data-record-field="${key}"]`)?.value);
    const tank = value('tank'), use = value('perLap'), rate = value('rate');
    target.innerHTML = `<div class="calc-preview"><b>Base values before racing effects</b><div class="calc-preview-numbers"><span>Full tank: <strong>${use > 0 ? (tank / use).toFixed(1) + ' laps' : 'no consumption'}</strong></span><span>Empty to full: <strong>${rate > 0 ? (tank / rate).toFixed(1) + ' s' : 'no refuelling'}</strong></span></div></div>`;
  }
  return { render };
})();
