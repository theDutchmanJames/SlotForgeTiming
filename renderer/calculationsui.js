// Calculations uses the same saved systems and pure rules as race preparation.
// Example inputs are local to this page; only labelled Save controls persist rules.
const CalculationPage = (() => {
  const EXAMPLE = { laps: '10, 10.2, 9.8, 12', lap: 9.5, target: 10 };
  let active = 'pace',
    selected = {},
    example = { ...EXAMPLE };
  // (2.4.0, SlotForgeRestyle.md "Engineer's Bench") the bench: unsaved values of a saved system (Try it follows them), the system to compare with per
  // example, the source of the example laps (typed, or a real race), the refs of the last drawing, and the index to find a formula
  let drafts = {},
    compareWith = {},
    lapSource = { kind: 'example', race: '', driver: '', races: null, laps: null, left: [] },
    lastRefs = {},
    findIndex = null;
  // the examples that use a saved system (to compare with another one)
  const LAB_ENTITY = { wear: 'pushsavesystems', penalty: 'penaltysystems', safety: 'safetycarsystems', scoring: 'championships' };
  // the formulas that show the numbers of Try it in their example
  const LIVE = {
    'Pace difference': 'pace',
    'Push & Save curve': 'curve',
    'Tyre wear this lap': 'wear',
    'Normal service order': 'service',
    'Service Stop release': 'release',
    'Penalty points and tiers': 'penalty',
    'Combined fuel effects': 'combined',
    'Safety Car': 'safety',
    'Resource balance': 'resources',
    'Championship points': 'drops',
    'Fuel Range widget': 'range',
    'Tyre life estimate': 'life',
    'Fractional-lap gap': 'gap'
  };
  const sections = [
    ['pace', 'Pace benchmarks', 'Push & Save · Tyre Wear', 'var(--c-ps)'],
    ['fuel', 'Fuel & tyres', 'Consumption · grip · stacking', 'var(--c-fuel)'],
    ['effects', 'Race effects', 'Balance of Power · weather · damage', 'var(--c-wx)'],
    ['resources', 'Resource allocation', 'Tyre sets · repairs · components', '#56bfaa'],
    ['pits', 'Pit service & penalties', 'Service order · timers · consequences', 'var(--c-pen)'],
    ['estimates', 'Estimates & timing', 'Range · distance · gaps', 'var(--c-tok)'],
    ['results', 'Results & scoring', 'Eligible laps · heats · championships', 'var(--c-ch)']
  ];
  const entities = [
    'fuelrules',
    'tyrewearsystems',
    'pushsavesystems',
    'weathersystems',
    'damagesystems',
    'safetycarsystems',
    'penaltysystems',
    'racesetups',
    'championships',
    'rotationsetups',
    'tracks'
  ];
  const formula = (title, equation, text, worked) =>
    `<article class="calc-equation" data-formula="${esc(title)}"><h4>${esc(title)}</h4><code>${esc(equation)}</code><p>${esc(text)}</p>${
      worked || LIVE[title]
        ? `<p class="calc-worked"${LIVE[title] ? ` data-worked="${LIVE[title]}"` : ''}><b>${LIVE[title] ? 'With your numbers' : 'Example'}</b> <span>${esc(worked || '')}</span></p>`
        : ''
    }</article>`;
  const input = (key, label, value, max = 1000) =>
    `<label>${esc(label)}<input type="number" data-policy="${key}" min="0" max="${max}" step="1" value="${value}" required></label>`;
  const methods = current =>
    PushSave.BENCHMARKS.map(
      ([key, title]) =>
        `<option value="${key}"${current === key ? ' selected' : ''}>${esc(title.replace('recent valid', 'eligible').replace('in this race', 'in the selected history'))}</option>`
    ).join('');
  const routeButton = (tab, sub, text) =>
    `<button type="button" class="btn" data-calc-route="${tab}" data-sub="${sub}">${esc(text)}</button>`;
  const choice = (key, label, value, options) =>
    `<label>${esc(label)}<select name="${key}">${options.map(([v, t]) => `<option value="${v}"${String(value) === String(v) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
  const number = (key, label, value, min, max, step = 1) =>
    `<label>${esc(label)}<input name="${key}" type="number" min="${min}" max="${max}" step="${step}" value="${value}" required></label>`;
  function extraControls() {
    const e = PushSave.calculationSettings(state.settings).estimates;
    const fields =
      choice('gapMethod', 'Lap-gap reference', e.gapMethod, [
        ['median', 'Leader’s median lap'],
        ['average', 'Leader’s average lap']
      ]) +
      number('gapWindow', 'Gap history · 0 = all eligible laps', e.gapWindow, 0, 1000) +
      choice('fuelMethod', 'Fuel Range consumption estimate', e.fuelMethod, [
        ['average', 'Average actual consumption'],
        ['median', 'Median actual consumption']
      ]) +
      number('fuelWindow', 'Fuel history · 0 = each widget’s setting', e.fuelWindow, 0, 20);
    return `<form class="calc-policy" data-extra="estimates"><h4>Estimate preferences</h4><p>Display estimates only: these choices do not change classification, measured timing or fuel consumption. Fuel history is 3–20 laps, or 0 to keep each widget’s existing setting.</p><div class="calc-fields">${fields}</div><div class="calc-preview" data-extra-preview></div><button type="submit" class="btn">Save for new races</button> <button type="button" class="btn" data-extra-reset>Restore defaults</button><span class="calc-save" role="status"></span><p class="muted">Restore defaults fills this form; Save applies it. Running and recovered races keep their starting choices.</p></form>`;
  }
  const trials = {};
  function lab(kind, title, fields, note) {
    const ent = LAB_ENTITY[kind],
      rows = (ent && lastRefs[ent]) || [];
    const cmp =
      rows.length > 1
        ? `<label class="cb-cmp">Compare with<select data-cb-compare="${kind}"><option value="">Nothing</option>${rows
            .filter(r => r.id !== selected[ent])
            .map(r => `<option value="${esc(r.id)}"${compareWith[kind] === r.id ? ' selected' : ''}>${esc(titleOf(ent, r))}</option>`)
            .join('')}</select></label>`
        : '';
    return `<details class="calc-lab" open data-lab="${kind}"><summary>${title}</summary><p class="muted">${note}</p><div class="calc-fields">${fields}${cmp}</div><output class="calc-preview" aria-live="polite"></output></details>`;
  }
  function laboratories() {
    if (active === 'pits')
      return (
        lab(
          'service',
          'Try a pit stop',
          number('fuel', 'Fuel work · seconds', 8, 0, 3600) +
            number('repair', 'Repair work · seconds', 12, 0, 3600) +
            number('tyres', 'Tyre work · seconds', 10, 0, 3600) +
            choice('order', 'Work order', 'overlap', [
              ['overlap', 'All at the same time'],
              ['add', 'Fuel → repairs → tyres'],
              ['repair', 'Repairs after fuel; tyres alongside'],
              ['tyres', 'Fuel and repairs together; tyres after']
            ]) +
            number('reduction', 'Safety Car reduction · %', 0, 0, 90) +
            choice('fixed', 'Fixed Service Stop', 'off', [
              ['off', 'Off — normal work duration'],
              ['on', 'On — timer ends the stop']
            ]) +
            number('window', 'Fixed service window · seconds', 30, 1, 86400) +
            number('penalty', 'Additional penalty · seconds', 5, 0, 3600),
          'Example jobs, not a prediction for a particular car. Driver swaps, sensor confirmation, manual release and held pit exit may delay departure.'
        ) +
        lab(
          'penalty',
          'Try the selected penalty ladder',
          number('points', 'Total penalty points', 5, 0, 10000),
          'Uses the saved Penalty System selected below. A higher unserved pit tier replaces the lower one. Already served stops and Special Penalties stay separate.'
        )
      );
    if (active === 'fuel')
      return lab(
        'combined',
        'See the combined fuel effects',
        number('bop', 'Balance of Power · signed %', 0, -90, 90) +
          number('weather', 'Weather handicap · %', 20, 0, 90) +
          number('grip', 'Tyre Performance · signed %', 10, -90, 90) +
          ['bop', 'weather', 'grip']
            .map(k =>
              choice(k + 'Lever', k === 'bop' ? 'BoP affects' : k === 'weather' ? 'Weather affects' : 'Tyre performance affects', 'all', [
                ['all', 'Fuel, refuelling and tank'],
                ['use', 'Fuel use only'],
                ['rate', 'Refuelling only'],
                ['tank', 'Tank only'],
                ['none', 'No fuel effects']
              ])
            )
            .join('') +
          number('use', 'Base fuel per lap · L', 2, 0, 10000, 0.1) +
          number('rate', 'Base refuel speed · L/s', 10, 0.1, 10000, 0.1) +
          number('tank', 'Base tank · L', 100, 0.1, 10000, 0.1),
        'Positive helps; negative hinders. These example switches let you see each source’s contribution; they do not change saved systems.'
      );
    if (active === 'pace')
      return lab(
        'wear',
        'See the combined tyre wear',
        number('base', 'Base wear · % per lap', 2, 0, 100, 0.01) +
          number('reference', 'Earlier benchmark · seconds', 10, 0.001, 3600, 0.001) +
          number('lap', 'New lap · seconds', 8, 0.001, 3600, 0.001) +
          number('weather', 'Weather wear multiplier', 1, 0, 20, 0.1) +
          number('temperature', 'Temperature multiplier', 1, 1, 3, 0.1),
        'Uses the selected Push & Save System below; base wear, weather and temperature are example inputs. The example benchmark is supplied explicitly, so history learning is not simulated.'
      );
    if (active === 'estimates')
      return lab(
        'estimate',
        'Try the estimates',
        number('fuelLeft', 'Fuel left · L', 30, 0, 10000, 0.1) +
          number('used', 'Average use · L per lap', 2.5, 0.01, 1000, 0.01) +
          number('life', 'Tyre life left · %', 60, 0, 100, 1) +
          number('wear', 'Base wear · % per lap', 2, 0.01, 100, 0.01) +
          number('gap', 'Time gap to the leader · seconds', 2, 0, 3600, 0.01) +
          number('pace', 'Leader pace · seconds', 10, 0.1, 3600, 0.01),
        'Example values; in a race they come from the laps already driven and the saved systems.'
      );
    if (active === 'effects')
      return lab(
        'safety',
        'Try a Safety Car lap and stop',
        number('lap', 'Full yellow lap · seconds', 14, 0.001, 3600, 0.001) +
          number('service', 'Ordinary service · seconds', 10, 0, 3600, 0.1),
        'Uses the selected saved Safety Car System below. Partial-yellow laps do not receive a target-pace penalty. Penalties and driver swaps are not shortened.'
      );
    if (active === 'resources')
      return lab(
        'resources',
        'Follow a supply allocation',
        number('sets', 'Starting allocation · tyre sets', 3, 0, 100000) +
          number('changes', 'Completed tyre changes', 1, 0, 100000) +
          number('credits', 'Repair credits', 3, 0, 100000) +
          number('components', 'Replacement components', 1, 0, 100000) +
          number('damage', 'Completed damage repairs requested', 1, 0, 100000) +
          number('failures', 'Completed failure repairs requested', 1, 0, 100000),
        'Illustration with all limits enabled: one starting set, then tyre changes, damage repairs and failure repairs. Insufficient supplies leave work undone. Editing a saved profile never refills existing allocations.'
      );
    if (active === 'results')
      return (
        lab(
          'scoring',
          'Keep overall and class scores separate',
          number('overall', 'Overall position', 3, 1, 1000) +
            number('classPos', 'Class position', 1, 1, 1000) +
            number('bonus', 'Eligible bonus points · each example', 1, 0, 1000) +
            number('share', 'Session points share · %', 100, 0, 100) +
            choice('round', 'Rounding', 'nearest', [
              ['nearest', 'Nearest'],
              ['up', 'Up'],
              ['down', 'Down'],
              ['none', 'No rounding']
            ]),
          'Uses the selected Championship points table below for both example classifications, without a class override. Bonus input represents an already-eligible award. These are separate scores, never added together.'
        ) +
        lab(
          'drops',
          'Try dropped results',
          `<label>Decided round scores · comma separated<input name="scores" value="10, 6, 8"></label>` +
            number('drop', 'Results to drop', 1, 0, 1000),
          'Example driver totals after bonuses and rounding. Lowest scores drop first; earlier equal scores drop first. At least one decided result remains.'
        )
      );
    return '';
  }
  function wireTools(box, refs) {
    const record = (entity, draft = true) => {
      const row = refs[entity]?.find(r => r.id === selected[entity]) || refs[entity]?.[0];
      return row && draft && drafts[entity] ? { ...row, ...drafts[entity] } : row;
    };
    box.querySelectorAll('[data-extra]').forEach(form => {
      const read = () =>
        Object.fromEntries([...form.querySelectorAll('[name]')].map(el => [el.name, el.type === 'number' ? Number(el.value) : el.value]));
      const refresh = () => {
        const v = read();
        form.querySelector('[data-extra-preview]').textContent =
          `Gap: ${v.gapMethod}, ${v.gapWindow || 'all'} eligible laps. Fuel Range: ${v.fuelMethod}, ${v.fuelWindow || 'widget-selected'} recent laps (at least 3).`;
      };
      form.oninput = refresh;
      form.querySelector('[data-extra-reset]').onclick = () => {
        for (const [k, v] of Object.entries(PushSave.estimatePolicy())) form.elements[k].value = v;
        refresh();
      };
      form.onsubmit = async ev => {
        ev.preventDefault();
        if (!form.reportValidity()) return;
        const v = read();
        if (v.fuelWindow > 0 && v.fuelWindow < 3) {
          form.querySelector('.calc-save').textContent = 'Use 0 or at least 3 fuel samples.';
          return;
        }
        await save(form, () => api.setSettings({ raceEstimates: PushSave.estimatePolicy(v) }), true);
      };
      refresh();
    });
    box.querySelectorAll('[data-lab]').forEach(panel => {
      const kind = panel.dataset.lab;
      for (const el of panel.querySelectorAll('[name]')) if (trials[kind]?.[el.name] !== undefined) el.value = trials[kind][el.name];
      panel.querySelector('[data-cb-compare]')?.addEventListener('input', ev => (compareWith[kind] = ev.target.value));
      const draw = () => {
        if ([...panel.querySelectorAll('input')].some(el => !el.checkValidity() || el.value === '')) {
          panel.querySelector('output').textContent = 'Enter valid example values to see the calculation.';
          return;
        }
        const v = Object.fromEntries(
          [...panel.querySelectorAll('[name]')].map(el => [el.name, el.type === 'number' ? Number(el.value) : el.value])
        );
        trials[kind] = v;
        const n = x => Number(x.toFixed(3)),
          stat = (label, value) => `<span>${esc(label)}<strong>${esc(value)}</strong></span>`;
        const compute = rec => {
          let html = '';
          const live = {};
          if (kind === 'service') {
            const f = 1 - v.reduction / 100,
              j = {
                fuel: v.fuel * f,
                repair: v.repair * f,
                tyres: v.tyres * f,
                repairAdd: ['add', 'repair'].includes(v.order),
                tyreAdd: ['add', 'tyres'].includes(v.order)
              };
            const natural = Math.max(
                j.fuel,
                (j.repairAdd ? j.fuel : 0) + j.repair,
                (j.tyreAdd ? Math.max(j.fuel, (j.repairAdd ? j.fuel : 0) + j.repair) : 0) + j.tyres
              ),
              duration = v.fixed === 'on' ? v.window : natural;
            const ends = PitHold.servicePlan(j),
              total = duration + v.penalty,
              max = Math.max(1, total, natural);
            html =
              `<p><b>Work completes: ${n(natural)} s · timer release: ${n(total)} s (including ${n(v.penalty)} s penalty)</b></p>` +
              ['fuel', 'repair', 'tyres', 'penalty']
                .map((k, i) => {
                  const start = k === 'penalty' ? duration : ends[k] - j[k],
                    end = k === 'penalty' ? total : ends[k];
                  return `<div class="calc-job"><span>${['Fuel', 'Repairs', 'Tyres', 'Penalty'][i]} · ${n(start)}–${n(end)} s</span><div><i style="margin-left:${(start / max) * 100}%;width:${((end - start) / max) * 100}%;background:${['var(--c-fuel)', 'var(--c-dmg)', 'var(--c-tyre)', 'var(--c-pen)'][i]}"></i></div></div>`;
                })
                .join('') +
              `<p>${natural > total ? 'Some work remains unfinished at timer release; fuel is kept as refuelled, incomplete changes are not applied.' : 'Work retains its own duration; any remaining time is waiting.'}</p>`;
            live.service = `Fuel ${n(j.fuel)} s, repairs ${n(j.repair)} s, tyres ${n(j.tyres)} s → the work is done at ${n(natural)} s.`;
            live.release =
              v.fixed === 'on'
                ? `Timer ${n(v.window)} s + penalty ${n(v.penalty)} s → released at ${n(total)} s.`
                : `No timer: released when the work is done (${n(natural)} s) + ${n(v.penalty)} s penalty = ${n(total)} s.`;
          } else if (kind === 'combined') {
            const lever = k => ({
                use: ['all', 'use'].includes(v[k + 'Lever']),
                rate: ['all', 'rate'].includes(v[k + 'Lever']),
                tank: ['all', 'tank'].includes(v[k + 'Lever'])
              }),
              f = Bop.mix([
                [v.bop, lever('bop')],
                [-v.weather, lever('weather')],
                [v.grip, lever('grip')]
              ]);
            html =
              stat('Fuel per lap', `${n(v.use * f.use)} L · ×${n(f.use)}`) +
              stat('Refuelling', `${n(v.rate * f.rate)} L/s · ×${n(f.rate)}`) +
              stat('Tank', `${n(v.tank * f.tank)} L · ×${n(f.tank)}`) +
              `<p>BoP ${v.bop > 0 ? '+' : ''}${v.bop}% · weather −${v.weather}% · tyres ${v.grip > 0 ? '+' : ''}${v.grip}%. Contributions add per enabled effect and stop at ±90%.</p>`;
            live.combined = `BoP ${v.bop > 0 ? '+' : ''}${v.bop}%, weather −${v.weather}%, tyres ${v.grip > 0 ? '+' : ''}${v.grip}% → fuel use ×${n(f.use)}, refuel ×${n(f.rate)}, tank ×${n(f.tank)}.`;
          } else if (kind === 'wear') {
            const ps = rec('pushsavesystems'),
              p = ps ? PushSave.lapEffect(PushSave.clean(ps), { ref: v.reference * 1000, lapMs: v.lap * 1000, lapNo: 100 }) : { tyres: 1 },
              total = v.base * v.weather * v.temperature * p.tyres;
            html =
              stat('Calculated wear this lap', `${n(total)} percentage points`) +
              `<p>${v.base}% base × ${v.weather} weather × ${v.temperature} temperature × ${n(p.tyres)} Push & Save = <b>${n(total)}%</b>. Remaining life stops at 0%.</p><p>${ps ? 'Push & Save: ' + esc(ps.name) : 'No Push & Save selected: pace has no effect on wear.'}</p>`;
            live.wear = `${v.base}% × ${v.weather} × ${v.temperature} × ${n(p.tyres)} = ${n(total)}% of tyre life this lap.`;
          } else if (kind === 'penalty') {
            const row = rec('penaltysystems');
            if (!row) html = '<p>Create a Penalty System below to try its ladder.</p>';
            else {
              const p = RaceEngine.penaltyConfig(row),
                e = RaceEngine.penaltyEffects(p, v.points);
              html =
                stat('Time total', `${n(RaceEngine.penaltyMs(p, v.points) / 1000)} s`) +
                stat('Scoring laps deducted', e.laps) +
                stat('Unserved tier requires', `${e.pit} s in pits`) +
                `<p>${p.dq && v.points >= p.dq ? 'Point-limit disqualification applies.' : 'Point-limit disqualification not reached.'} Testing ${esc(row.name)}.</p>`;
              live.penalty = `${v.points} points with ${row.name}: ${n(RaceEngine.penaltyMs(p, v.points) / 1000)} s and ${e.laps} ${e.laps === 1 ? 'lap' : 'laps'} deducted.`;
            }
          } else if (kind === 'safety') {
            const row = rec('safetycarsystems');
            if (!row) html = '<p>Create a Safety Car System below to try its rules.</p>';
            else {
              const c = SafetyCar.clean(row),
                failed = c.target > 0 && v.lap * 1000 < c.target;
              html =
                stat('Full-yellow lap', failed ? 'Too fast' : c.target ? 'Target met' : 'No target enforced') +
                stat('Penalty points', failed ? c.points : 0) +
                stat('Service work', `${n(v.service * (1 - c.pit / 100))} s`) +
                `<p>Using ${esc(row.name)}. The service reduction is fixed at pit entry.</p>`;
              live.safety = `A ${v.lap} s full-yellow lap is ${failed ? 'too fast' : 'fine'}; ${v.service} s of work becomes ${n(v.service * (1 - c.pit / 100))} s.`;
            }
          } else if (kind === 'estimate') {
            const range = Math.floor(v.fuelLeft / v.used + 1e-9),
              life = Math.floor(v.life / v.wear + 1e-9),
              gap = Math.round((v.gap / v.pace) * 10) / 10;
            html =
              stat('Fuel range', `about ${range} ${range === 1 ? 'lap' : 'laps'}`) +
              stat('Tyre life', `about ${life} ${life === 1 ? 'lap' : 'laps'}`) +
              stat('Gap in laps', `+${gap} laps`) +
              `<p>Display estimates only: they never change the classification or the timing.</p>`;
            live.range = `${v.fuelLeft} L ÷ ${v.used} L per lap = about ${range} laps.`;
            live.life = `${v.life}% ÷ ${v.wear}% per lap = about ${life} laps.`;
            live.gap = `${v.gap} s ÷ ${v.pace} s = +${gap} laps.`;
          } else if (kind === 'resources') {
            const sets = Math.max(0, v.sets - 1),
              changes = Math.min(sets, v.changes),
              damage = Math.min(v.credits, v.damage),
              failures = Math.min(v.credits - damage, v.components, v.failures);
            html =
              stat('Unused tyre sets', sets - changes) +
              stat('Repair credits left', v.credits - damage - failures) +
              stat('Components left', v.components - failures) +
              `<p>Starting set: ${v.sets ? 1 : 0}; completed tyre changes: ${changes}/${v.changes}; damage repairs: ${damage}/${v.damage}; failure repairs: ${failures}/${v.failures}.</p>`;
            live.resources = `${v.sets} sets − 1 starting set − ${changes} ${changes === 1 ? 'tyre change' : 'tyre changes'} = ${sets - changes} unused.`;
          } else if (kind === 'scoring') {
            const row = rec('championships');
            if (!row) html = '<p>Create a Championship below to preview its points table.</p>';
            else {
              const c = Champ.clean(row);
              if (c.pointsMode === 'beaten')
                return {
                  html: '<p>This championship awards points for opponents beaten. Use a position-table championship for this table preview; its scoring rules are unchanged.</p>',
                  live
                };
              const score = pos => ChampPts.scaled((c.points[pos - 1] ?? c.pointsRest) + v.bonus, v.share, v.round);
              html =
                stat('Overall points', score(v.overall)) +
                stat('Class points', score(v.classPos)) +
                `<p>Separate standings using ${esc(row.name)}. Bonuses shown here assume both example entries are eligible.</p>`;
            }
          } else if (kind === 'drops') {
            const a = v.scores.split(',').map(s => s.trim());
            if (!a.length || a.some(x => x === '' || !Number.isFinite(+x) || +x < 0)) {
              html = '<p>Enter non-negative round scores separated by commas.</p>';
            } else {
              const scores = a.map(Number),
                dropped = new Set(
                  scores
                    .map((score, i) => ({ score, i }))
                    .sort((a, b) => a.score - b.score || a.i - b.i)
                    .slice(0, Math.min(v.drop, scores.length - 1))
                    .map(x => x.i)
                );
              live.drops = `Scores ${scores.join(', ')}, ${dropped.size} dropped → ${scores.reduce((t, x, i) => t + (dropped.has(i) ? 0 : x), 0)} points.`;
              html =
                scores.map((x, i) => `<span>Round ${i + 1}: ${dropped.has(i) ? `<s>${x}</s> · dropped` : `<b>${x}</b>`}</span>`).join('') +
                stat(
                  'Kept total',
                  scores.reduce((s, x, i) => s + (dropped.has(i) ? 0 : x), 0)
                );
            }
          }
          return { html, live };
        };
        const ent = LAB_ENTITY[kind],
          main = compute(entity => record(entity, true));
        let extra = '';
        if (ent && drafts[ent]) {
          const saved = compute(entity => record(entity, false));
          if (saved.html !== main.html) extra += `<div class="cb-also"><b>With the saved values</b>${saved.html}</div>`;
        }
        const cmp = ent && compareWith[kind] ? refs[ent]?.find(r => r.id === compareWith[kind]) : null;
        if (cmp)
          extra += `<div class="cb-also"><b>Compare: ${esc(titleOf(ent, cmp))}</b>${compute(entity => (entity === ent ? cmp : record(entity, true))).html}</div>`;
        panel.querySelector('output').innerHTML = main.html + extra;
        for (const [k, t] of Object.entries(main.live))
          box.querySelectorAll(`[data-worked="${k}"] span`).forEach(el => (el.textContent = t));
      };
      panel.oninput = draw;
      draw();
    });
  }
  function policyCard(prefix, title, color) {
    const p = PushSave.policyFromSettings(state.settings, prefix);
    return `<form class="calc-policy" data-prefix="${prefix}" style="--calc-accent:${color}"><h4>${title}</h4><p>Used by the current Push & Save model. Legacy systems retain their original reference rules.</p><div class="calc-fields"><label>Benchmark<select data-policy="Benchmark">${methods(p.benchmark)}</select></label>${input('Window', 'Recent eligible laps · 0 = all', p.pacePolicy.window)}${input('Minimum', 'Minimum samples · 0 = automatic', p.pacePolicy.minimum)}</div><p class="muted">Automatic: median / average / weighted / trimmed need 3 samples; previous / best need 1. Track target needs no history. The current lap is compared with earlier laps, never with itself. Weighted: oldest to newest weights 1, 2, 3… Trimmed: remove 10% from each end, rounded down (fewer than 10 samples: ordinary average).</p><output data-preview="${prefix}" class="calc-preview"></output><button class="btn" type="submit">Save ${title} calculation</button><span class="calc-save" role="status"></span></form>`;
  }
  function recordControl(e, refs, fields = []) {
    const rows = refs[e] || [],
      current = rows.find(r => r.id === selected[e]) || rows[0];
    if (current) selected[e] = current.id;
    const schema = state.schema[e];
    if (!schema) return '';
    if (e === 'pushsavesystems' && current && current.mode !== 'median') fields = ['normal', ...fields.filter(k => k !== 'pushAt')];
    const inline = current
      ? fields
          .map(key => {
            const f = schema.fields.find(f => f.key === key);
            if (!f || !['number', 'select'].includes(f.type)) return '';
            if (f.type === 'select')
              return `<label>${esc(f.label)}<select data-record-field="${key}">${f.options.map(([v, t]) => `<option value="${esc(v)}"${(current[key] ?? f.default) === v ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
            return `<label>${esc(f.label)}${f.suffix ? ` (${esc(f.suffix)})` : ''}<input type="number" min="${f.min ?? 0}"${f.max !== undefined ? ` max="${f.max}"` : ''} step="any" data-record-field="${key}" value="${esc(current[key] ?? f.default ?? 0)}" required></label>`;
          })
          .join('')
      : '';
    return `<section class="calc-record" data-entity="${e}"><label>${esc(schema.label)}<select data-record-select${rows.length ? '' : ' disabled'}>${rows.length ? rows.map(r => `<option value="${esc(r.id)}"${r.id === current.id ? ' selected' : ''}>${esc(titleOf(e, r))}</option>`).join('') : '<option>No saved systems yet</option>'}</select></label>${inline ? `<form class="calc-record-form"><div class="calc-fields">${inline}</div><button class="btn">Save system values</button><span role="status" class="calc-save"></span></form>` : ''}<div class="calc-actions"><button class="btn" type="button" data-edit-record${current ? '' : ' disabled'}>Edit all ${esc(schema.label.toLowerCase())} rules</button><button class="btn" type="button" data-new-record>Create ${esc(schema.label.toLowerCase())}</button></div><p class="muted">These are the original saved settings. Changes also appear in Race Setup and apply to new races that use this system.</p></section>`;
  }
  function content(refs) {
    if (active === 'resources')
      return `${formula('Resource balance', 'remaining = initial allocation + director adjustments − completed services', 'Each driver, slotcar or team has its own account. Event accounts span heats; championship accounts span loaded championship sessions. Points awards and result deletion do not change balances. Editing a profile does not refill existing accounts.', 'Three tyre sets − one starting set − one completed tyre change = one unused set.')}${formula('Service cost', 'tyre change = 1 set of the fitted compound\ndamage repair = 1 repair credit\nfailure repair = 1 repair credit + 1 replacement component', 'Each limit applies only when enabled. Failure repair reserves both supplies together. Insufficient supplies leave work undone, without charging a partial cost. Starting sets count; abandoned work and penalties consume no repair credits.', 'Damage plus failure repaired in one stop: two repair credits and one component when both limits are on.')}${routeButton('setup', 'resources', 'Edit Resource Systems')}`;
    if (active === 'pace')
      return `<p class="calc-intro">Push & Save is the only pace-sensitive wear control for new races. Previously saved races retain their starting rules. Eligible history excludes pit, slow, red-interrupted and full yellow laps. Removing or invalidating a lap rebuilds future references; it does not refund fuel or wear already used.</p>
      <section class="calc-example"><h4>Try a lap sequence</h4><div class="calc-fields"><label>Earlier eligible laps · seconds, separated by commas<input data-example="laps" value="${esc(example.laps)}"></label><label>New lap · seconds<input data-example="lap" type="number" min="0.001" step="0.001" value="${example.lap}"></label><label>Track target · seconds<input data-example="target" type="number" min="0" step="0.001" value="${example.target}"></label></div><p class="muted">Preview only. In a race, Track target comes from the active track in the Database.</p></section>
      ${policyCard('pushSave', 'Push & Save', 'var(--c-ps)')}
      ${formula('Pace difference', '(lap ÷ reference − 1) × 100%', 'A negative difference is faster; a positive difference is slower. No available reference means normal use and wear.', '9.5 s against 10 s = −5%: pushing.')}
      ${formula('Push & Save curve', 'push: 1 + extra × min(1, −pace ÷ push threshold)\nsave: 1 − saving × min(1, pace ÷ save threshold)', 'Extra and saving are fractions. Fuel and tyres have their own switches and amounts. Early laps and excluded laps have no normal pace effect; the yellow-save option is a separate rule.', 'At −1.5%, with full push at −3% and +40% tyre wear, tyre multiplier = 1.20.')}
      ${formula('Tyre wear this lap', 'wear = base × weather × temperature × Push & Save tyres', 'Base wear comes from the Tyre Wear System and the compound. Remaining life stops at 0%.', '')}
      ${recordControl('pushsavesystems', refs, ['pushAt', 'saveAt', 'tyreExtra', 'tyreSave', 'fuelExtra', 'fuelSave'])}
      ${recordControl('tyrewearsystems', refs, ['stop', 'changeSeconds'])}`;
    if (active === 'fuel')
      return `${recordControl('fuelrules', refs, ['tank', 'perLap', 'rate'])}<div id="calc-fuel-example"></div>
      ${formula('Fuel consumption', 'litres used = base litres per lap × combined use factor × Push & Save fuel factor', 'Without Push & Save, older Fuel Systems may still use their legacy target-lap curve. New Fuel Systems use their fixed per-lap amount. Damage is not part of the combined fuel multiplier.', '2 L × 1.20 hindrance × 1.25 push = 3 L per lap.')}
      ${formula('Combined fuel effects', 'signed effect = clamp(sum of enabled source percentages, −90, +90)\nuse = 1 − effect / 100; rate and tank = 1 + effect / 100', 'Balance of Power, weather and tyre grip add independently for each enabled lever. Positive helps; negative hinders. The tank lever applies only when enabled. They do not change measured lap times.', '−20% weather + 10% tyre help = −10%: 1.10 × fuel use; 0.90 × refuel rate if both levers are enabled.')}
      ${formula('Tyre life used', 'wear = compound wear × weather multiplier × distance factor × Push & Save tyres × temperature', 'Distance factor is 1 per lap, or lane length divided by 100 m / 100 ft for distance-based wear. Life is clamped to 0–100%.', '2% × 1.5 weather × 1.20 push × 1.02 temperature = 3.672 percentage points of life.')}
      ${formula('Simulated tyre temperature', 'target = working midpoint + pace offset + 0.5 × (ambient now − dry ambient)\npace offset: intensity × 0.75 × range width; intensity scales from −1 at full Save to +1 at full Push\nnew temperature = move toward target by at most warm-up degrees per eligible lap\ncooling = move toward ambient by cooling degrees/minute × elapsed minutes', 'Temperature is optional in Tyre Wear. Weather mode uses air temperature converted to Celsius. Pits and yellow/red pauses cool. Recovery does not simulate offline time. Without eligible Push & Save data, the target is Normal.')}
      ${formula('Temperature wear multiplier', 'cold fraction = clamp((range low − T) ÷ (range low + 20), 0, 1)\nhot fraction = clamp((T − range high) ÷ (180 − range high), 0, 1)\nmultiplier = 1 + fraction × configured extra wear ÷ 100', 'Working-range temperatures have multiplier 1. The lap uses the mean temperature before/after its warming step; the widget shows the multiplier at the current temperature. Temperatures are bounded to −20…180 °C. Initial lifespan estimates assume multiplier 1.', 'With range 60–90 °C, T = 20 °C and 20% maximum cold wear: fraction 0.5 → wear ×1.10.')}
      ${formula('Fresh-tyre grip and the cliff', 'above cliff: bonus × (life − cliff) / (100 − cliff)\nbelow cliff: −hindrance × (cliff − life) / cliff', 'The curve meets zero at a nonzero cliff; a zero cliff applies full hindrance at empty. The resulting percentage feeds the enabled fuel levers. Grip does not speed up the measured clock.', 'Bonus 10%, cliff 40%, life 70% → +5% help.')}${recordControl('tyrewearsystems', refs, ['stop', 'changeSeconds'])}${recordControl('weathersystems', refs)}`;
    if (active === 'effects')
      return `${bopControls()}
      ${formula('Automatic Balance of Power', 'spread = slowest pace − fastest pace\nscaled strength = maximum × min(1, spread ÷ full-effect gap)', 'Pace uses the chosen average or median and history window. Lane correction divides pace by lane length / mean lane length. Apply and remove thresholds avoid rapid switching. Graded mode scales each car by its distance from the field midpoint.', 'With a 20% maximum, full effect at 1 s and a 0.5 s spread, scaled strength is 10%.')}
      ${formula('Weather handicap', 'selected condition + fitted tyre category → configured help / hindrance', 'The Weather System owns condition probabilities, durations, wrong-tyre penalties and the handicap table. Tyre Wear owns its separate weather-wear table. Custom tyres inherit their chosen weather category.')}${recordControl('weathersystems', refs)}
      ${formula('Damage and failures', 'damage points → highest reached level\nrepair work → configured duration for that level', 'Damage level, repair work and failure chance have their own tables and triggers. Each failure is drawn once per car when a race or heat starts. Its chance is multiplied by the car’s failure factor, capped at 100%; the maximum-failures limit can discard drawn failures. A 10% chance with factor 2 means a 20% draw, not a check every lap.')}${recordControl('damagesystems', refs, ['stop'])}
      ${formula('Safety Car', 'too fast when full-yellow lap < configured target\nreduced pit work = normal work × (1 − reduction / 100)', 'Penalty points and pit reduction have independent switches. Track Call power behaviour comes from Race Setup. Random Flag conditions can hold pit exit or require a target pace; they do not rewrite the lap clock.')}${recordControl('safetycarsystems', refs, ['targetOn', 'target', 'pointsOn', 'points', 'pitOn', 'pitPercent'])}`;
    if (active === 'pits')
      return `${formula('Normal service order', 'fuel finish = missing litres ÷ effective rate\nrepair finish = repair time + (sequential ? fuel finish : 0)\ntyre finish = tyre time + (sequential ? max(fuel finish, repair finish) : 0)', 'The longest completion time sets the normal service duration. Driver-swap and sensor rules can also prevent release.', 'Fuel 8 s, repair 12 s, tyres 10 s: all parallel → 12 s; both sequential → 30 s.')}
      ${formula('Service Stop release', 'job finish = actual service completion time\ntimer release = service timer + penalty time', 'Work is never stretched or compressed. Timer mode ends at its deadline. The Race Director can release at any time. Driver mode ends after removal, return and departure, ignoring the timer. Unfinished fuel remains partially filled; other unfinished jobs are not applied. Random Flag pit-exit holds still apply.', 'Fuel 15 s + tyres 2 s in sequence: work ends at 17 s. A 30 s timer waits another 13 s; a departure at 16 s keeps the fuel but leaves the tyres unchanged.')}
      ${recordControl('racesetups', refs, ['serviceStop', 'pitServiceWork', 'pitHoldSeconds'])}
      ${formula('Penalty points and tiers', 'per-point: consequence = points × amount\ntable: highest reached threshold supplies the consequence', 'A higher unserved pit tier replaces the lower tier. Completed pit penalties remain served; Special Penalties remain separate. Time and lap totals are recalculated from the current tier. Disqualification checks use the enabled thresholds.', 'Thresholds: 1 → nothing, 3 → 5 s, 5 → 10 s. Four points give 5 s; five give 10 s total.')}${recordControl('penaltysystems', refs)}${recordControl('damagesystems', refs, ['stop'])}${recordControl('tyrewearsystems', refs, ['stop', 'changeSeconds'])}`;
    if (active === 'estimates')
      return `<div class="calc-actions">${routeButton('custom', 'layouts', 'Edit widget estimates in Layout Editor')}${routeButton('custom', 'charts', 'Edit chart calculations')}</div>${formula('Fuel Range widget', 'estimated laps left = remaining fuel ÷ selected average or median actual sampled use', 'The widget samples 3–20 recent clean laps and waits for at least 3. Estimates above choose average or median actual use and can override the widget history length. It includes effects actually applied on those laps. The sample count belongs to each widget in the Layout Editor.', '30 L remaining / 2.5 L average used = about 12 laps.')}
      ${formula('Tyre life estimate', 'laps left = remaining life ÷ base wear for current weather and lane', 'This is a base estimate. It does not predict future pace or future weather. The system’s “Lasts about” control sets base wear as 100 / desired lifetime.', '60% life / 2% per lap = about 30 laps; 800-lap base life means 0.125% wear.')}
      ${formula('Fractional-lap gap', 'lap gap ≈ engine time gap ÷ selected leader pace estimate', 'Uses the median by default; choose average and a history window above. Rounded to one decimal. Practice and qualifying continue to compare best times. Track length is not needed to convert a time gap into a fraction of a lap; distance racing has separate length-based estimates.', '2 s gap / 10 s median = +0.2 laps.')}
      ${formula('Speed, scale speed and distance', 'speed (km/h) = lane metres / lap seconds × 3.6\nscale speed = physical speed × scale factor\ndistance = sum of counted lane lengths', 'Feet, miles and other display units are conversions of stored metres. A missing lane length means a speed or distance estimate is unavailable.')}
      ${formula('Sensors, red flags and first crossing', 'minimum accepted interval = max(0.800 s, track minimum)\ninterrupted lap stays counted but is invalid for records', 'Race Setup controls formation-lap behaviour, red-flag restart and any optional interrupted-lap time addition. Pauses are excluded from the running clock. Sensor thresholds and pit confirmation are distinct from pace sampling.')}${recordControl('tracks', refs, ['targetLap', 'minLap', 'maxLap'])}${recordControl('racesetups', refs)}`;
    return `${formula('Average and median', 'average = sum of eligible lap times ÷ count\nmedian = middle sorted value (or mean of the two middle values)', 'Push & Save and Tyre Wear use the separate pace policies above. Charts have their own sampling options. Eligibility differs by purpose: a pit lap can count in a race result while being excluded from pace learning.')}
      ${formula('Consistency', 'consistency = √(sum of squared deviations ÷ number of eligible laps)', 'Results cards, database Statistics and generated reports use the same population standard deviation. At least two eligible laps are needed. Invalid, removed, slow and pit laps do not count; late token laps are invalid. Existing lap records stay unchanged; derived consistency is recalculated when displayed.', 'For 9 s and 11 s: mean = 10 s; consistency = 1 s on every screen.')}
      ${formula('Classification and records', 'adjusted time = measured race time + applicable time consequences\nclassification follows the selected session winner rule', 'Invalid laps remain in distance unless removed, but cannot set fastest laps, Personal Bests or Track Records. Removed laps do not count. Disqualified and retired participants follow the session classification rules. Practice and qualifying compare eligible best laps.')}
      ${formula('Multi-Class scoring', 'class position = rank among eligible entries in the same class\nclass points = class position table + eligible class bonuses\noverall points and class points are separate totals', 'Each class reuses the heat or championship rules for ties, dropped results, sprint shares and team allocation. Choose a table override in Race Setup > Multi-Class Systems.')}
      ${formula('Virtual Rival replay', 'replay lap = recorded lap × 100 ÷ replay speed (%)\nreplay progress = elapsed race clock', 'Pauses and red flags freeze replay. Invalid source laps are excluded; pit laps are optional. Replayed service time is not charged a second time. Change speed and sequence in Race Setup > Virtual Rival Systems.')}
      ${formula('Plugin race rules', 'consumption = built-in amount × frozen plugin factor\neffective time += valid-lap rule time\ncompetition points += eligible plugin bonus', 'Optional: choose one rule plugin in Race Setup → Rules and Systems. Configure it under App Settings → Plugins. Its bounded program is frozen before racing, stored with results and never changes raw lap times. Fuel/tyre factors are limited to 0–10; disabled systems stay disabled. No plugin worker is called during timing.')}
      ${formula('Heat points', 'heat position → selected points table\naggregate = selected heat results under the heat scoring rule', 'Heat Setup controls which results count, tie ordering, finals and points. Race Results displays the points supplied by that competition; absent points are shown as unavailable, not invented as zero.')}${recordControl('racesetups', refs)}${recordControl('rotationsetups', refs)}
      ${formula('Championship points', 'session score = rounded share of position points and eligible bonuses\nstanding = sum of kept round scores', 'Sprint share and rounding, fastest-lap eligibility, pole and start bonuses, guest scoring, team contribution, dropped results and tie order are configured in the Championship. Dropped results remove the lowest scores, with earlier equal scores dropped first; at least one decided result remains.', 'Scores 10, 6, 8 with one dropped result → 18 points before other rounds.')}${recordControl('championships', refs)}
      ${formula('Time Tokens and endurance', 'token balance = purchased time − elapsed chargeable time', 'A token lane counts laps while paid time remains. Endurance tracks stint time or distance and applies configured missing-swap consequences. The corresponding setup editors retain these rules; normal fuel and tyre systems do not run in a Time Token session.')}${routeButton('setup', 'tokens', 'Edit Time Token rules')}`;
  }
  function bopControls() {
    const c = Bop.settingsOf(state.settings);
    return `<form class="calc-bop calc-policy"><h4>Balance of Power calculation</h4><div class="calc-fields"><label>Measure<select name="bopMeasure"><option value="median"${c.measure === 'median' ? ' selected' : ''}>Median</option><option value="average"${c.measure === 'average' ? ' selected' : ''}>Average</option></select></label><label>Recent laps<input name="bopWindow" type="number" min="3" max="50" value="${c.window}" required></label><label>Minimum laps<input name="bopMinLaps" type="number" min="1" max="50" value="${c.minLaps}" required></label></div><button class="btn">Save Balance of Power calculation</button><span class="calc-save" role="status"></span><p class="muted">Uses the same settings as the Balance of Power page.</p>${routeButton('setup', 'bop', 'Edit all Balance of Power rules')}</form>`;
  }
  // the formulas of every topic (to find one, and for the formula sheet)
  function allTopics() {
    const keep = active,
      out = [];
    try {
      for (const [id, title] of sections) {
        active = id;
        const t = document.createElement('template');
        t.innerHTML = content(lastRefs);
        out.push({
          id,
          title,
          formulas: [...t.content.querySelectorAll('.calc-equation')].map(a => ({
            title: a.querySelector('h4')?.textContent || '',
            equation: a.querySelector('code')?.textContent || '',
            text: a.querySelector(':scope > p')?.textContent || '',
            worked: a.querySelector('.calc-worked span')?.textContent || ''
          }))
        });
      }
    } finally {
      active = keep;
    }
    return out;
  }
  // (2.4.0) the laps of a real race as the example: the races, then a driver's laps (the last one is the new lap)
  async function loadRaces() {
    const page = await api.historyPage('racing', {});
    lapSource.revision = page.revision;
    lapSource.races = ((page.sessions && page.sessions.items) || [])
      .filter(x => x && x.sessionType !== 'tokens')
      .slice(0, 40)
      .map(x => ({
        id: x.id,
        name: `${x.setupName || 'Race'}${x.trackName ? ' · ' + x.trackName : ''} · ${new Date(x.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
      }));
    if (!lapSource.race && lapSource.races[0]) lapSource.race = lapSource.races[0].id;
  }
  async function loadLaps() {
    lapSource.laps = null;
    lapSource.drivers = [];
    if (!lapSource.race) return;
    const d = await api.historySession('racing', lapSource.race, { revision: lapSource.revision, exportAll: true });
    lapSource.laps = (d && d.laps) || [];
    lapSource.drivers = ((d && d.session && d.session.standings) || [])
      .filter(x => x.driverId)
      .map(x => ({ id: x.driverId, name: x.driverName || 'Driver' }));
    if (!lapSource.drivers.some(x => x.id === lapSource.driver)) lapSource.driver = lapSource.drivers[0]?.id || '';
    useDriver();
  }
  function useDriver() {
    const mine = (lapSource.laps || [])
      .filter(l => l.driverId === lapSource.driver && l.time > 0)
      .sort((a, b) => a.lapNumber - b.lapNumber);
    if (mine.length < 2) return;
    example.laps = mine
      .slice(0, -1)
      .map(l => (l.time / 1000).toFixed(3))
      .join(', ');
    example.lap = Number((mine.at(-1).time / 1000).toFixed(3));
    lapSource.left = mine.slice(0, -1).map(l => !!(l.invalid || l.pit || l.removed || l.excluded));
  }
  function sourceHtml() {
    const race = lapSource.kind === 'race';
    const sel = (attr, label, list, cur) =>
      `<select ${attr} aria-label="${label}">${(list || []).map(x => `<option value="${esc(x.id)}"${x.id === cur ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select>`;
    return `<div class="cb-src"><span class="cb-seg" role="group" aria-label="Example laps"><button type="button" data-cb-src="example" class="${race ? '' : 'on'}" aria-pressed="${!race}">Example laps</button><button type="button" data-cb-src="race" class="${race ? 'on' : ''}" aria-pressed="${race}">From a real race</button></span>${
      race
        ? lapSource.races && lapSource.races.length
          ? sel('data-cb-race', 'Race', lapSource.races, lapSource.race) +
            (lapSource.drivers && lapSource.drivers.length
              ? sel('data-cb-driver', 'Driver', lapSource.drivers, lapSource.driver)
              : '<span class="cb-none">No laps in this race.</span>')
          : '<span class="cb-none">No finished race to take laps from yet.</span>'
        : ''
    }</div><div class="cb-bars" id="cb-bars" aria-hidden="true"></div><label class="cb-slide"><span>New lap</span><input type="range" data-cb-lap min="1" max="20" step="0.01" value="${esc(example.lap)}" aria-label="New lap in seconds"><b data-cb-lapv></b></label><div class="cb-out" id="cb-pace" aria-live="polite"></div>`;
  }
  async function render(box, note = '') {
    const rows = await Promise.all(entities.map(e => api.list(e))),
      refs = Object.fromEntries(entities.map((e, i) => [e, rows[i]]));
    if (!box.isConnected) return;
    Object.assign(state.refs, refs);
    lastRefs = refs;
    findIndex = null;
    const section = sections.find(s => s[0] === active);
    const [question, line] = CalcBench.head(active);
    // (2.4.0, "Engineer's Bench") the parts of a topic sorted onto the bench: the examples to try, the saved rules, and the formulas
    const tpl = document.createElement('template');
    tpl.innerHTML = (active === 'estimates' ? extraControls() : '') + laboratories() + content(refs);
    const tries = [],
      rules = [],
      formulas = [],
      routes = [];
    let intro = '';
    for (const n of [...tpl.content.children]) {
      if (n.matches('.calc-equation')) formulas.push(n.outerHTML);
      else if (n.matches('.calc-lab, .calc-example, #calc-fuel-example')) tries.push(n.outerHTML);
      else if (n.matches('.calc-intro')) intro = n.textContent.trim();
      else if (n.matches('[data-calc-route]')) routes.push(n.outerHTML);
      else if (n.matches('.calc-actions')) routes.push(n.innerHTML);
      else rules.push(n.outerHTML);
    }
    // the systems of this topic, and the race setups that use them
    const ents = [...new Set([...rules.join('').matchAll(/data-entity="([a-z]+)"/g)].map(m => m[1]))];
    const fields = state.schema.racesetups?.fields || [];
    const users = new Set();
    const chips = ents
      .map(e => {
        const row = refs[e]?.find(r => r.id === selected[e]);
        if (!row || e === 'racesetups' || e === 'tracks') return '';
        CalcBench.usedBy(refs.racesetups, fields, e, row.id).forEach(n => users.add(n));
        return `<span class="cb-chip"><i></i>${esc(state.schema[e]?.label || e)}: ${esc(titleOf(e, row))}</span>`;
      })
      .join('');
    const used = chips ? `<span class="cb-chip">${esc(CalcBench.usedText([...users]))}</span>` : '';
    const bench = `<header class="cb-hd"><div><span class="cb-k">Calculations · ${esc(section[1])}</span><h1>${esc(question)}</h1><p>${esc(line)}</p>${chips ? `<div class="cb-used">${chips}${used}</div>` : ''}</div><div class="cb-tools"><div class="cb-find"><input type="search" data-cb-find placeholder="Find a calculation…" aria-label="Find a calculation" autocomplete="off"><div class="cb-found" hidden></div></div><button type="button" class="btn sm" data-cb-sheet title="Every formula on one page, to print or keep">Formula sheet</button></div></header>
      <div class="cb-bench"><section class="cb-try" aria-label="Try it"><div class="cb-tryh"><h2>Try it</h2><span class="cb-tag">Preview · nothing is saved</span><button type="button" class="btn sm ghost" data-cb-reset>Reset</button></div><div class="cb-tryb">${active === 'pace' ? sourceHtml() : ''}${[...tries.filter(t => t.startsWith('<section class="calc-example')), ...tries.filter(t => !t.startsWith('<section class="calc-example'))].join('')}${
        !tries.length && active !== 'pace'
          ? '<p class="cb-none">This topic has no example to try. Its rules are beside it, its formulas below.</p>'
          : ''
      }</div></section>
      <section class="cb-rules" aria-label="Your rules"><div class="cb-rulh"><h2>Your rules</h2><span class="cb-k">saved · used in new races</span></div><div class="cb-rulb">${rules.join('') || '<p class="cb-none">Nothing to set here.</p>'}${routes.length ? `<div class="cb-routes">${routes.join('')}</div>` : ''}</div><div class="cb-save"><span class="cb-dot" aria-hidden="true"></span><span data-cb-state role="status">${esc(note || 'Everything is saved')}</span><button type="button" class="btn sm ghost" data-cb-undo disabled>Undo</button><button type="button" class="btn primary sm" data-cb-saveall disabled>Save</button></div></section></div>
      <section class="cb-how" aria-label="How it is worked out"><div class="cb-howh"><h2>How it is worked out</h2><span class="cb-k">${Object.values(LIVE).some(k => formulas.join('').includes(`data-worked="${k}"`)) ? 'with your numbers from Try it' : ''}</span></div>${intro ? `<p class="cb-intro">${esc(intro)}</p>` : ''}<div class="cb-fm">${formulas.join('')}</div></section>`;
    box.innerHTML = `<section class="calc-page calc-expanded setuppage"><header class="calc-head"><div><p class="eyebrow">SETTINGS FOR FUTURE RACES</p><h3>Calculations</h3><p>In plain words: choose how pace is measured, see what every racing system adds, and tune the original settings in one place.</p></div><aside><b>Predictable races</b><span>A running race keeps its starting rules. New results retain those rules for review.</span></aside></header><div class="calc-shell"><nav class="calc-rail" aria-label="Calculation sections">${sections.map(([id, title, note, color]) => `<button class="btn" type="button" data-calc-section="${id}" aria-current="${id === active ? 'page' : 'false'}" style="--calc-accent:${color}"><b>${title}</b><small>${note}</small></button>`).join('')}</nav><main class="calc-content cb-on" style="--calc-accent:${section[3]};--cb:${section[3]}">${bench}</main></div></section>`;
    box.querySelectorAll('[data-calc-section]').forEach(
      b =>
        (b.onclick = async () => {
          if (
            box._cbDirty &&
            !(await Dialog.confirm('Leave this topic without saving your changes?', { ok: 'Leave without saving', danger: true }))
          )
            return;
          drafts = {};
          active = b.dataset.calcSection;
          render(box);
        })
    );
    box.querySelectorAll('[data-calc-route]').forEach(
      b =>
        (b.onclick = () => {
          state.tab = b.dataset.calcRoute;
          if (state.tab === 'custom') state.customSub = b.dataset.sub;
          else state.setupSub = b.dataset.sub;
          window.render();
        })
    );
    box.querySelectorAll('[data-example]').forEach(
      el =>
        (el.oninput = () => {
          example[el.dataset.example] = el.value;
          preview(box);
        })
    );
    box.querySelectorAll('[data-prefix]').forEach(form => {
      form.oninput = () => preview(box);
      form.onsubmit = async ev => {
        ev.preventDefault();
        if (!form.reportValidity()) return;
        const p = readPolicy(form),
          prefix = form.dataset.prefix;
        const automatic = ['last', 'best'].includes(p.benchmark) ? 1 : 3;
        if (p.benchmark !== 'track' && p.window && p.window < (p.minimum || automatic)) {
          form.querySelector('.calc-save').textContent = 'History must hold at least the required samples.';
          return;
        }
        await save(
          form,
          () => api.setSettings({ [prefix + 'Benchmark']: p.benchmark, [prefix + 'Window']: p.window, [prefix + 'Minimum']: p.minimum }),
          true
        );
      };
    });
    const bop = box.querySelector('.calc-bop');
    if (bop)
      bop.onsubmit = async ev => {
        ev.preventDefault();
        const data = Object.fromEntries(new FormData(bop));
        if (+data.bopMinLaps > +data.bopWindow) {
          bop.querySelector('.calc-save').textContent = 'Minimum laps cannot exceed the history window.';
          return;
        }
        data.bopWindow = +data.bopWindow;
        data.bopMinLaps = +data.bopMinLaps;
        await save(bop, () => api.setSettings(data), true);
      };
    box.querySelectorAll('[data-entity]').forEach(panel => {
      const e = panel.dataset.entity,
        row = refs[e].find(r => r.id === selected[e]);
      panel.querySelector('[data-record-select]').onchange = async ev => {
        if (
          box._cbDirty &&
          !(await Dialog.confirm('Choose another system without saving your changes?', { ok: 'Choose it', danger: true }))
        ) {
          ev.target.value = selected[e];
          return;
        }
        drafts = {};
        selected[e] = ev.target.value;
        render(box);
      };
      const edit = async item => {
        if (e === 'championships' || e === 'rotationsetups') {
          state.tab = 'setup';
          state.setupSub = e === 'championships' ? 'championships' : 'rotation';
          await window.render();
          const host = document.getElementById('setupmgr');
          const button = item
            ? [...host.querySelectorAll('[data-edit]')].find(b => b.dataset.edit === item.id)
            : host.querySelector(e === 'championships' ? '#newch' : '#newrot');
          if (button) button.click();
          return;
        }
        openForm(e, item);
        dlg.addEventListener(
          'close',
          () => {
            if (box.isConnected) render(box);
          },
          { once: true }
        );
      };
      panel.querySelector('[data-edit-record]').onclick = () => edit(row);
      panel.querySelector('[data-new-record]').onclick = () => edit(null);
      const form = panel.querySelector('form');
      if (form) {
        const patchOf = () =>
          Object.fromEntries(
            [...form.querySelectorAll('[data-record-field]')].map(el => [
              el.dataset.recordField,
              el.tagName === 'SELECT' ? el.value : Number(el.value)
            ])
          );
        // (2.4.0) Try it follows the values before they are saved
        form.oninput = () => {
          drafts[e] = patchOf();
          fuelPreview(box);
          preview(box);
          box.querySelectorAll('[data-lab]').forEach(el => el.dispatchEvent(new Event('input')));
        };
        form.onsubmit = async ev => {
          ev.preventDefault();
          if (!form.reportValidity()) return;
          const patch = patchOf();
          if (e === 'pushsavesystems' && row.mode !== 'median' && patch.saveAt <= patch.normal) {
            form.querySelector('.calc-save').textContent = 'Full save must be slower than normal pace.';
            return;
          }
          await save(form, async () => {
            const result = await api.update(e, row.id, patch);
            Object.assign(row, patch);
            delete drafts[e];
            box.querySelectorAll('[data-lab]').forEach(el => el.dispatchEvent(new Event('input')));
            return result;
          });
        };
      }
    });
    preview(box);
    fuelPreview(box);
    wireTools(box, refs);
    benchWire(box);
  }
  // (2.4.0, "Engineer's Bench") one save bar for the rules of a topic, Undo, Reset, the real race, Find and the formula sheet
  function benchWire(box) {
    const forms = [...box.querySelectorAll('.cb-rules form')];
    forms.forEach(f => (f._submit = f.onsubmit));
    const fieldsOf = f => [...f.querySelectorAll('input, select')].filter(el => el.name || el.dataset.policy || el.dataset.recordField);
    const snap = new Map(forms.map(f => [f, fieldsOf(f).map(el => [el, el.value])]));
    const bar = box.querySelector('.cb-save'),
      st = bar.querySelector('[data-cb-state]'),
      undo = bar.querySelector('[data-cb-undo]'),
      saveAll = bar.querySelector('[data-cb-saveall]');
    const changes = () =>
      forms.flatMap(f =>
        snap
          .get(f)
          .filter(([el, v]) => el.value !== v)
          .map(() => f)
      );
    const show = () => {
      const n = changes().length;
      bar.classList.toggle('dirty', n > 0);
      if (n) st.textContent = `${n} unsaved ${n === 1 ? 'change' : 'changes'}`;
      undo.disabled = saveAll.disabled = n === 0;
      box._cbDirty = n > 0;
    };
    box._cbDirty = false;
    // (2.4.0 review) a form saved with its own button is saved: what it holds now is where Undo goes back to, and the bar no longer counts it
    forms.forEach(f => {
      if (!f._submit) return;
      f.onsubmit = async ev => {
        const said = f.querySelector('.calc-save');
        if (said) said.textContent = ''; // (an earlier "Saved" is not taken for this one)
        await f._submit(ev);
        const msg = f.querySelector('.calc-save')?.textContent || '';
        if (/^Saved/.test(msg))
          snap.set(
            f,
            fieldsOf(f).map(el => [el, el.value])
          );
        show();
      };
    });
    const rules = box.querySelector('.cb-rules');
    rules.addEventListener('input', show);
    rules.addEventListener('change', show);
    undo.onclick = () => {
      for (const [f, list] of snap) {
        let moved = false;
        for (const [el, v] of list)
          if (el.value !== v) {
            el.value = v;
            moved = true;
          }
        if (moved) f.dispatchEvent(new Event('input', { bubbles: true }));
      }
      drafts = {};
      box.querySelectorAll('[data-lab]').forEach(el => el.dispatchEvent(new Event('input')));
      preview(box);
      show();
      st.textContent = 'Changes undone.';
    };
    saveAll.onclick = async () => {
      const dirty = [...new Set(changes())],
        errors = [];
      undo.disabled = saveAll.disabled = true;
      st.textContent = 'Saving…';
      for (const f of dirty) {
        if (!f.checkValidity()) {
          f.reportValidity();
          errors.push('Check the values marked in red.');
          continue;
        }
        await f._submit?.({ preventDefault() {} });
        const msg = f.querySelector('.calc-save')?.textContent || '';
        if (msg && !/^Saved/.test(msg)) errors.push(msg);
      }
      if (errors.length) {
        st.textContent = errors[0];
        undo.disabled = saveAll.disabled = false;
        return;
      }
      drafts = {};
      render(box, 'Saved for new races.');
    };
    box.querySelector('[data-cb-reset]').onclick = () => {
      for (const k of Object.keys(trials)) delete trials[k];
      example = { ...EXAMPLE };
      compareWith = {};
      lapSource.kind = 'example';
      render(box);
    };
    // the laps of a real race
    box.querySelectorAll('[data-cb-src]').forEach(
      b =>
        (b.onclick = async () => {
          lapSource.kind = b.dataset.cbSrc;
          try {
            if (lapSource.kind === 'race' && !lapSource.races) {
              await loadRaces();
              await loadLaps();
            } else if (lapSource.kind === 'race') useDriver();
            else example = { ...EXAMPLE };
          } catch (e) {
            lapSource.races = [];
            st.textContent = 'Could not read the races: ' + e.message;
          }
          render(box);
        })
    );
    const raceSel = box.querySelector('[data-cb-race]'),
      driverSel = box.querySelector('[data-cb-driver]');
    if (raceSel)
      raceSel.onchange = async () => {
        lapSource.race = raceSel.value;
        await loadLaps().catch(() => {});
        render(box);
      };
    if (driverSel)
      driverSel.onchange = () => {
        lapSource.driver = driverSel.value;
        useDriver();
        render(box);
      };
    const slide = box.querySelector('[data-cb-lap]');
    if (slide)
      slide.oninput = () => {
        example.lap = Number(slide.value);
        const typed = box.querySelector('[data-example="lap"]');
        if (typed) typed.value = slide.value;
        preview(box);
      };
    // find a calculation in any topic
    const find = box.querySelector('[data-cb-find]'),
      found = box.querySelector('.cb-found');
    find.oninput = () => {
      if (!findIndex) findIndex = CalcBench.index(allTopics());
      const hits = CalcBench.find(findIndex, find.value);
      found.hidden = !find.value.trim();
      found.innerHTML = hits.length
        ? hits
            .map(
              h =>
                `<button type="button" data-cb-go="${esc(h.topic)}" data-cb-f="${esc(h.title)}"><b>${esc(h.title)}</b><small>${esc(h.topicTitle)}</small></button>`
            )
            .join('')
        : '<p>Nothing found. Try another word, such as fuel, gap or points.</p>';
    };
    find.onkeydown = ev => {
      if (ev.key === 'Escape') {
        find.value = '';
        found.hidden = true;
      }
      if (ev.key === 'Enter') found.querySelector('button')?.click();
    };
    found.onclick = async ev => {
      const b = ev.target.closest('[data-cb-go]');
      if (!b) return;
      if (b.dataset.cbGo !== active) {
        if (
          box._cbDirty &&
          !(await Dialog.confirm('Leave this topic without saving your changes?', { ok: 'Leave without saving', danger: true }))
        )
          return;
        drafts = {};
        active = b.dataset.cbGo;
        await render(box);
      } else found.hidden = true;
      const card = [...box.querySelectorAll('[data-formula]')].find(x => x.dataset.formula === b.dataset.cbF);
      if (card) {
        card.scrollIntoView({ block: 'center', behavior: 'smooth' });
        card.classList.add('cb-flash');
        setTimeout(() => card.classList.remove('cb-flash'), 2400);
      }
    };
    // the formula sheet: every topic on one page
    box.querySelector('[data-cb-sheet]').onclick = async () => {
      try {
        const res = await api.shareSave(
          CalcBench.sheetHtml(allTopics(), {
            title: 'Race calculations',
            sub: `${state.settings.appName || 'SlotForge Timing'}: how pace, fuel, tyres, pit stops, estimates and scores are worked out.`
          }),
          'Race calculations.html',
          'html'
        );
        st.textContent = res && res.saved ? 'Formula sheet saved to ' + res.path : 'The formula sheet was not saved.';
      } catch (e) {
        st.textContent = 'Could not save the formula sheet: ' + e.message;
      }
    };
  }
  async function save(form, write, settings = false) {
    const button = form.querySelector('button'),
      status = form.querySelector('.calc-save');
    button.disabled = true;
    try {
      const result = await write();
      if (settings) state.settings = result;
      status.textContent = 'Saved for new races';
    } catch (e) {
      status.textContent = 'Could not save: ' + e.message;
    } finally {
      button.disabled = false;
    }
  }
  function readPolicy(form) {
    const value = key => form.querySelector(`[data-policy="${key}"]`).value;
    return { benchmark: value('Benchmark'), window: Number(value('Window')), minimum: Number(value('Minimum')) };
  }
  function preview(box) {
    const laps = String(example.laps)
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(Number)
      .filter(n => Number.isFinite(n) && n > 0);
    box.querySelectorAll('[data-prefix]').forEach(form => {
      const p = readPolicy(form),
        ref = PushSave.benchmark(
          p.benchmark,
          laps.map(n => n * 1000),
          Number(example.target) * 1000,
          p
        ),
        lap = Number(example.lap) * 1000;
      const pace = ref > 0 && lap > 0 ? (lap / ref - 1) * 100 : null;
      const out = form.querySelector('output');
      const position = pace === null ? 50 : Math.max(2, Math.min(98, 50 + pace * 2));
      out.innerHTML = `<div class="calc-preview-numbers"><b>${ref ? (ref / 1000).toFixed(3) + ' s reference' : 'Waiting for reference'}</b><span>${pace === null ? 'Add enough eligible laps or a track target' : (pace > 0 ? '+' : '') + pace.toFixed(2) + '% · ' + (pace < 0 ? 'faster' : pace > 0 ? 'slower' : 'at benchmark')}</span></div><div class="calc-pace-bar" aria-hidden="true"><i style="left:${position}%"></i></div><div class="calc-bar-labels"><span>Faster</span><span>Benchmark</span><span>Slower</span></div>`;
      if (form.dataset.prefix === 'pushSave') benchPace(box, laps, ref, lap, pace);
    });
  }
  // (2.4.0, "Engineer's Bench") the new lap against its benchmark, big: the bars of the laps, the slider, the verdict, a gauge and what it does
  function benchPace(box, laps, ref, lap, pace) {
    const target = box.querySelector('#cb-pace');
    if (!target) return;
    const rows = lastRefs.pushsavesystems || [],
      saved = rows.find(r => r.id === selected.pushsavesystems) || rows[0];
    const draft = saved && drafts.pushsavesystems ? { ...saved, ...drafts.pushsavesystems } : saved;
    const cfgOf = r => (r ? PushSave.clean(r) : null),
      cfg = cfgOf(draft);
    const effOf = c =>
      c && ref > 0 && lap > 0 ? PushSave.lapEffect(c, { ref, lapMs: lap, lapNo: 100 }) : { tyres: 1, fuel: 1, kind: 'normal' };
    const eff = effOf(cfg);
    const pushAt = cfg ? cfg.pushAt : 3,
      saveAt = cfg ? cfg.saveAt : 8;
    const full = pace !== null && cfg && ((pace < 0 && -pace >= pushAt) || (pace > 0 && pace >= saveAt));
    const v = CalcBench.verdict(pace, { tyres: eff.tyres, full });
    const pos = pace === null ? 50 : pace < 0 ? 50 - 50 * Math.min(1, -pace / pushAt) : 50 + 50 * Math.min(1, pace / saveAt);
    let also = '';
    if (draft !== saved) {
      const before = effOf(cfgOf(saved));
      if (before.tyres !== eff.tyres || before.fuel !== eff.fuel)
        also = `<p class="cb-vs">With the saved values: tyres ${CalcBench.pctOf(before.tyres)}, fuel ${CalcBench.pctOf(before.fuel)}.</p>`;
    }
    target.innerHTML = `<span class="cb-k">This lap</span><h3 class="cb-${v.state}">${esc(v.head)}</h3><div class="cb-gauge" role="img" aria-label="${esc(v.head)}"><i style="left:${pos}%"></i></div><div class="cb-gl"><span>full push −${pushAt}%</span><span>benchmark</span><span>full save +${saveAt}%</span></div><div class="cb-fx"><span>Tyres <b>${CalcBench.pctOf(eff.tyres)}</b> wear</span><span>Fuel <b>${CalcBench.pctOf(eff.fuel)}</b> use</span><span>Benchmark <b>${ref > 0 ? (ref / 1000).toFixed(2) + ' s' : '—'}</b></span></div>${
      cfg ? '' : '<p class="cb-vs">No Push & Save system yet: pace has no effect on wear or fuel.</p>'
    }${also}`;
    // the formulas with these numbers
    const say = (k, t) => box.querySelectorAll(`[data-worked="${k}"] span`).forEach(el => (el.textContent = t));
    if (pace !== null) {
      say(
        'pace',
        `${(lap / 1000).toFixed(2)} ÷ ${(ref / 1000).toFixed(2)} − 1 = ${pace > 0 ? '+' : pace < 0 ? '−' : ''}${Math.abs(pace).toFixed(1)}% (${pace < 0 ? 'faster' : pace > 0 ? 'slower' : 'the benchmark'}).`
      );
      say(
        'curve',
        `${pace > 0 ? '+' : pace < 0 ? '−' : ''}${Math.abs(pace).toFixed(1)}% → tyres ×${eff.tyres.toFixed(2)}, fuel ×${eff.fuel.toFixed(2)}${draft ? ` with ${draft.name}` : ''}.`
      );
    } else say('pace', 'Add enough earlier laps (or a track target) for a benchmark.');
    // the earlier laps as bars, the benchmark as a line, the new lap in the colour of the topic
    const slow = cfg && ref > 0 ? (cfg.slow || 150) / 100 : 0;
    const left = laps.map((s, i) => !!(lapSource.kind === 'race' && lapSource.left[i]) || (slow > 0 && s * 1000 > ref * slow));
    const step = Math.max(1, Math.ceil(laps.length / 10)); // (at most about ten numbers under the bars)
    const bars = CalcBench.lapBars(laps, ref / 1000, lap / 1000, left),
      host = box.querySelector('#cb-bars');
    if (host)
      host.innerHTML = bars
        ? `<div class="cb-barrow">${bars.bars.map(b => `<span class="${b.out ? 'out' : ''}" style="height:${b.pct}%" title="${b.s.toFixed(3)} s${b.out ? ' · left out' : ''}"></span>`).join('')}${bars.lap ? `<span class="new" style="height:${bars.lap.pct}%" title="New lap ${bars.lap.s.toFixed(3)} s"></span>` : ''}${
            bars.ref ? `<em style="bottom:${bars.ref.pct}%"><small>benchmark ${bars.ref.s.toFixed(2)} s</small></em>` : ''
          }</div><div class="cb-barx">${bars.bars.map((b, i) => `<span>${i % step === 0 ? b.s.toFixed(1) : ''}</span>`).join('')}${bars.lap ? `<span class="new">${bars.lap.s.toFixed(1)}</span>` : ''}</div>${
            left.some(Boolean) ? '<small class="cb-left">Striped laps are left out (slow, pit or invalid).</small>' : ''
          }`
        : '<p class="cb-none">Enter earlier laps to see them here.</p>';
    const slide = box.querySelector('[data-cb-lap]');
    if (slide && bars) {
      if (document.activeElement !== slide) {
        slide.min = Math.max(0.1, bars.min).toFixed(2);
        slide.max = bars.max.toFixed(2);
      }
      slide.value = String(lap / 1000);
      const shown = box.querySelector('[data-cb-lapv]');
      if (shown) shown.textContent = (lap / 1000).toFixed(2) + ' s';
    }
  }
  function fuelPreview(box) {
    const target = box.querySelector('#calc-fuel-example'),
      panel = box.querySelector('[data-entity="fuelrules"]');
    if (!target || !panel) return;
    if (!panel.querySelector('[data-record-field]')) {
      target.textContent = 'Choose or create a Fuel System to preview its range and refuel duration.';
      return;
    }
    const value = key => Number(panel.querySelector(`[data-record-field="${key}"]`)?.value);
    const tank = value('tank'),
      use = value('perLap'),
      rate = value('rate');
    target.innerHTML = `<div class="calc-preview"><b>Base values before racing effects</b><div class="calc-preview-numbers"><span>Full tank: <strong>${use > 0 ? (tank / use).toFixed(1) + ' laps' : 'no consumption'}</strong></span><span>Empty to full: <strong>${rate > 0 ? (tank / rate).toFixed(1) + ' s' : 'no refuelling'}</strong></span></div></div>`;
  }
  return { render };
})();
