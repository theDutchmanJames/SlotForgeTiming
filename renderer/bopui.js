// Balance of Power settings (board 11, 1.79.0) and the lane controls shared by the race screens.
// Stored keys, cleaning and race rules come from bop.js.
const BopSettings = (() => {
  const rules = () => typeof module !== 'undefined' && module.exports ? require('./bop.js') : Bop;
  const join = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  function describe(value) {
    const R = rules(), s = R.clean(value), mode = { manual: 'Manual', suggest: 'Suggest', auto: 'Automatic' }[s.mode];
    const effects = [s.use && 'Fuel use', s.rate && 'Refuelling', s.tank && 'Tank size'].filter(Boolean);
    const lines = helped => [s.use && `uses ${s.percent}% ${helped ? 'less' : 'more'} fuel per lap`,
      s.rate && `refuels ${s.percent}% ${helped ? 'faster' : 'slower'}`, s.tank && `has a ${s.percent}% ${helped ? 'bigger' : 'smaller'} tank`].filter(Boolean);
    const say = [s.mode === 'manual' ? 'Manual: the Race Director presses Hinder or Help for a lane.'
      : s.mode === 'suggest' ? 'Suggest: the app watches the lap times and proposes, and the Race Director accepts.'
      : 'Automatic: the app applies and removes it by itself. The Race Director can still overrule a lane.'];
    const who = s.who === 'both' ? 'Hinder the fastest, help the slowest' : s.who === 'hinder' ? 'Only hinder the fastest' : 'Only help the slowest';
    if (s.mode !== 'manual') say.push(who + '.', s.grade === 'graded' ? 'Every car gets a share according to how far it is from the middle of the field.' : 'Only the fastest and the slowest car are considered; everybody in between is left alone.');
    say.push(s.scale === 'scaled' && s.mode !== 'manual' ? `The strength grows with the difference, up to ${s.percent}% at ${s.full} s per lap.` : `The percentage is ${s.percent}%.`);
    say.push(effects.length ? `A hindered car ${join(lines(false))}; a helped car gets the opposite.` : 'Every effect is switched off, so nothing would change on a car.');
    if (s.mode !== 'manual') say.push(`The pace is its ${s.measure === 'average' ? 'average' : 'median'} lap over the last ${s.window} laps (at least ${s.minLaps}). It comes on at a difference of ${s.apply} s per lap and goes off below ${s.remove} s.`,
      s.lanes ? 'The pace is corrected for the length of the lanes when their lengths are available.' : 'The pace is not corrected for the length of the lanes.');
    const changed = keys => keys.some(k => s[k] !== R.DEFAULTS[k]) ? 'ok' : 'plain';
    const entry = (t, state) => ({ rail: t, row: t, state });
    return { say: say.join(' '), effects, hindered: lines(false), helped: lines(true),
      pills: [mode, s.mode === 'manual' ? 'The Race Director decides' : who, `${s.percent}%`, effects.length ? join(effects) : 'All effects off'],
      rail: {
        who: entry(s.mode === 'manual' ? 'Manual · Race Director' : `${mode} · ${s.who === 'both' ? 'hinder and help' : s.who === 'hinder' ? 'hinder only' : 'help only'}`, changed(['mode', 'who', 'grade'])),
        amount: entry(`${s.percent}% · ${s.scale === 'fixed' ? 'always the same' : 'grows with the difference'}`, changed(['percent', 'scale', 'full'])),
        effects: entry(effects.length ? effects.join(' · ') : 'All effects off', effects.length ? changed(['use', 'rate', 'tank']) : 'todo'),
        auto: entry(s.mode === 'manual' ? 'Not used in Manual mode' : `${s.measure === 'median' ? 'Median' : 'Average'} · ${s.window} laps · ${s.apply} s`, s.mode === 'manual' ? 'plain' : changed(['measure', 'window', 'minLaps', 'apply', 'remove', 'lanes']))
      },
      threshold: { off: s.remove / (s.apply * 2) * 100, hold: (s.apply - s.remove) / (s.apply * 2) * 100, on: 50 } };
  }
  return { describe };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = { BopSettings };

async function renderBopSettings(box, page) {
  page = page || { open: new Set(['who', 'amount', 'effects', ...(Bop.settingsOf(state.settings).mode === 'manual' ? [] : ['auto'])]), rail: 'who', tail: Promise.resolve() };
  box.bopPage = page;
  const active = () => box.bopPage === page && box.isConnected !== false
    && (typeof state.tab !== 'string' || state.tab === 'setup')
    && (typeof state.setupSub !== 'string' || state.setupSub === 'bop');
  const S = Bop.settingsOf(state.settings), K = Bop.KEYS, el = id => document.getElementById(id);
  const I = (name, size = 18) => Icons.svg(name, { size, stroke: 1.8 });
  const opts = (list, v) => list.map(([k, t]) => `<option value="${esc(k)}"${k === v ? ' selected' : ''}>${esc(t)}</option>`).join('');
  const n3 = x => String(Math.round(x * 1000) / 1000);
  const choices = {
    mode: [['manual', 'Manual', 'The Race Director presses Hinder or Help for a lane.'], ['suggest', 'Suggest', 'The app watches the lap times and proposes, the Race Director accepts.'], ['auto', 'Automatic', 'The app applies and removes it by itself. The Race Director can still overrule a lane.']],
    who: [['both', 'Hinder the fastest, help the slowest', 'Both.'], ['hinder', 'Only hinder the fastest car'], ['help', 'Only help the slowest car']],
    grade: [['extremes', 'Only the fastest and the slowest car', 'Everybody in between is left alone.'], ['graded', 'Every car', 'By how far it is from the middle of the field.']],
    scale: [['fixed', 'Always the percentage above'], ['scaled', 'Less when the difference is small', 'It grows with the difference, up to the percentage above.']],
    measure: [['median', 'Median lap', 'One slow lap hardly counts.'], ['average', 'Average lap']]
  };
  const lists = { mode: Bop.MODES, who: Bop.WHO, grade: Bop.GRADE, scale: Bop.SCALE, measure: Bop.MEASURE };
  const cards = (key, label) => `<div class="field full"><span class="fu-q" id="bop-q-${key}">${esc(label)}</span><div class="fu-cards fu-c${choices[key].length}" role="group" aria-labelledby="bop-q-${key}">${choices[key].map(([v, title, line]) => `<button type="button" id="bop-pick-${key}-${v}" class="fu-card${S[key] === v ? ' on' : ''}" data-bop-pick="${key}" data-val="${v}" aria-pressed="${S[key] === v}"><span class="fu-ct"><b>${esc(title)}</b></span>${line ? `<span class="fu-cd">${esc(line)}</span>` : ''}<span class="fu-ck" aria-hidden="true">${I('check', 14)}</span></button>`).join('')}</div><select id="bop-${key}" hidden tabindex="-1" aria-hidden="true">${opts(lists[key], S[key])}</select></div>`;
  const check = (key, label, hint, icon) => `<div class="field full bop-effect${S[key] ? ' on' : ''}"><button type="button" id="bop-toggle-${key}" class="fu-sw${S[key] ? ' on' : ''}" role="switch" aria-checked="${S[key]}" aria-labelledby="bop-q-${key}" aria-describedby="bop-h-${key}" data-bop-toggle="${key}"><span class="fu-tg" aria-hidden="true"></span><span class="fu-swt"><b id="bop-q-${key}">${icon ? I(icon) : ''}${esc(label)}</b><span class="hint muted" id="bop-h-${key}">${esc(hint)}</span></span></button><input type="checkbox" id="bop-${key}"${S[key] ? ' checked' : ''} hidden tabindex="-1" aria-hidden="true"></div>`;
  const numberField = (key, id, label, min, max, step, unit) => `<div class="field"><label for="bop-${id}">${esc(label)}</label><span class="inunit"><input id="bop-${id}" type="number" min="${min}" max="${max}" step="${step}" value="${n3(S[key])}"><span>${esc(unit)}</span></span></div>`;
  const bodies = {
    who: RailForm.grid(cards('mode', 'Mode') + cards('who', 'Who gets it') + cards('grade', 'How many cars')
      + '<p class="muted hint full">Graded: the fastest car is hindered by the whole percentage, a car close to the middle hardly at all, and the slowest car is helped by the whole percentage. In Manual mode these choices are used when you switch to Suggest or Automatic.</p>'),
    amount: RailForm.grid(`<div class="field full"><label for="bop-percent">Percentage <small class="muted">A car never gets more than 90%</small></label><div class="bop-range"><strong id="bop-percent-n">${S.percent}%</strong><div><input type="range" id="bop-percent" min="1" max="${Bop.MAXP}" step="1" value="${S.percent}" aria-label="Balance of Power percentage"><div class="bop-scale" aria-hidden="true"><span>1%</span><span>30%</span><span>60%</span><span>90%</span></div></div></div></div>`
      + cards('scale', 'Strength') + (S.scale === 'scaled' ? numberField('full', 'full', 'Full percentage at a difference of (seconds per lap)', 0.1, 600, 0.1, 'seconds per lap') + '<p class="muted hint full">At half of that difference the car gets half of the percentage. Manual Hinder and Help always use the percentage above.</p>' : '')
      + '<div class="bop-examples full" id="bop-examples"></div><p class="muted hint full" id="bop-example"></p>'),
    effects: RailForm.grid(check('use', 'The fuel a lap uses', 'Hindered: more fuel per lap. Helped: less. The car has to pit sooner, or drive slower.', 'fuel')
      + check('rate', 'How fast it refuels in the pits', 'Hindered: slower stops. Helped: quicker stops.', 'clock')
      + check('tank', 'The size of the tank', 'Hindered: a smaller tank. Helped: a bigger one. Fuel in the tank that no longer fits is lost.', 'database')
      + '<p class="muted hint full">It only changes the fuel use, the refuelling and the tank of a car, so it fine-tunes: a car that is several seconds a lap faster will not be caught by it alone. Where a long race or a short tank makes the cars pit, it bites the most. It needs a Fuel System.</p>'),
    auto: RailForm.grid(cards('measure', 'The pace of a car is its')
      + numberField('window', 'window', 'Last laps that count', 3, 50, 1, 'laps')
      + numberField('minLaps', 'minlaps', 'Laps needed before it can apply', 1, S.window, 1, 'laps')
      + numberField('apply', 'apply', 'Apply at a difference of (seconds per lap)', 0.01, 600, 0.05, 'seconds')
      + numberField('remove', 'remove', 'Remove below a difference of (seconds)', 0, S.apply, 0.05, 'seconds')
      + '<div class="bop-threshold full" id="bop-threshold"></div><p class="muted hint full">The difference is between the pace of the fastest and the slowest car on the track. It comes on at the first number and goes off below the second, so it does not flicker on and off. Laps with a pit stop, invalid laps and laps taken out do not count.</p>'
      + check('lanes', 'Correct for the length of the lanes', 'A car on a longer lane is not held back for being on it. Needs the lane lengths of the track (Database > Tracks).'))
  };
  const sections = [
    { id: 'who', title: 'Who decides', ask: 'Does the Race Director decide, or the app?', icon: 'users' },
    { id: 'amount', title: 'How much', ask: 'How hard is a car hindered or helped?', icon: 'gauge' },
    { id: 'effects', title: 'What changes on the car', railTitle: 'What changes', ask: 'Which of the fuel rules are changed?', icon: 'fuel' },
    { id: 'auto', title: 'Suggest and Automatic', ask: S.mode === 'manual' ? 'Not used in Manual mode' : 'When does the app step in?', icon: 'bolt' }
  ];
  const sayHtml = w => `<span class="rsic rssayic">${I('say', 20)}</span><div class="rssaytext"><span class="rseye">In plain words</span><p>${esc(w.say)}</p></div>`;
  box.innerHTML = RailForm.shell({ page: true, tag: 'div', formId: 'bop-form', eyebrow: 'Settings for every race', cls: 'setupform ss-bop', icon: n => I(n, 20),
    tile: I('balance', 26), name: '<h3 class="bop-title">Balance of Power</h3>', caption: 'Balance of Power', navLabel: 'The sections of Balance of Power',
    usedHtml: '<div class="rsused"><span class="rsrl">To use it</span><span class="muted">Turn Balance of Power on in a race setup (Race Setups &gt; Rules and systems &gt; Balance of Power). It needs a Fuel System, because it works through the fuel rules.</span></div>',
    say: sayHtml(BopSettings.describe(S)),
    sections: sections.map(x => ({ ...x, domId: 'bop-section-' + x.id, open: page.open.has(x.id), body: bodies[x.id] })),
    foot: `<span class="muted rsdef">Every change is kept as you make it.</span><span id="bop-msg" role="status"></span><button class="btn" type="button" id="bop-reset">${I('undo')} Back to the standard settings</button>` });
  const frame = s => {
    const w = BopSettings.describe(s);
    el('rspills').innerHTML = w.pills.map((p, i) => `<span class="rspill${i ? '' : ' hi'}">${esc(p)}</span>`).join('');
    el('rssay').innerHTML = sayHtml(w);
    RailForm.sync(el, w.rail, null, page.rail);
    el('bop-section-auto').classList.toggle('bop-unused', s.mode === 'manual');
    const th = w.threshold;
    el('bop-threshold').innerHTML = `<div class="bop-threshold-bar" role="img" aria-label="Off below ${s.remove} seconds, stays as it is between ${s.remove} and ${s.apply} seconds, on from ${s.apply} seconds"><span style="width:${th.off}%">Off</span><span style="width:${th.hold}%">Stays as it is</span><span style="width:${th.on}%">On</span></div><div class="bop-threshold-labels"><span>Below ${s.remove} s: off</span><span>From ${s.apply} s: on</span></div>`;
    el('bop-percent-n').textContent = s.percent + '%';
    el('bop-example').textContent = w.effects.length ? `At ${s.percent}%, a hindered car ${Bop.effectText(-s.percent, s)}. A helped car gets the opposite.` : 'Every effect is switched off, so nothing would change on a car.';
    el('bop-examples').innerHTML = [['hindered', w.hindered], ['helped', w.helped]].map(([kind, lines]) => `<div class="bop-car ${kind}"><b>${I(kind === 'hindered' ? 'down' : 'up')} A ${kind} car, at ${s.percent}%</b>${lines.length ? `<ul>${lines.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '<p>No fuel rules change.</p>'}</div>`).join('');
  };
  frame(S);
  const status = (text, failed = false) => { const e = el('rsready'); e.className = 'rsready' + (failed ? '' : ' ok'); e.textContent = text; };
  status('Saved as you change it');
  const save = patch => {
    const id = document.activeElement && document.activeElement.id;
    const y = typeof window !== 'undefined' && typeof window.scrollY === 'number' ? window.scrollY : null;
    status('Saving...');
    const job = page.tail.then(async () => {
      try {
        state.settings = await api.setSettings(patch);
        if (!active()) return;
        await renderBopSettings(box, page);
        if (y !== null && window.scrollTo) window.scrollTo(0, y);
        const again = id && el(id); if (again && again.focus) again.focus({ preventScroll: true });
      } catch (x) { if (active()) { status('Could not save', true); el('bop-msg').textContent = 'Could not save: ' + (x.message || x); } }
    });
    page.tail = job; return job;
  };
  const cleaned = (key, short, v) => Bop.settingsOf({ ...state.settings, [key]: v })[short];
  const select = (id, key) => { el(id).onchange = ev => save({ [key]: ev.target.value }); };
  const number = (id, key, short) => { el(id).onchange = ev => save({ [key]: cleaned(key, short, ev.target.value) }); };
  ['mode', 'who', 'grade', 'scale', 'measure'].forEach(k => select('bop-' + k, K[k]));
  el('bop-percent').oninput = ev => frame({ ...S, percent: cleaned(K.percent, 'percent', ev.target.value) });
  el('bop-percent').onchange = ev => save({ [K.percent]: cleaned(K.percent, 'percent', ev.target.value) });
  if (S.scale === 'scaled') number('bop-full', K.full, 'full');
  ['use', 'rate', 'tank', 'lanes'].forEach(k => { el('bop-' + k).onchange = ev => save({ [K[k]]: !!ev.target.checked }); });
  number('bop-window', K.window, 'window'); number('bop-minlaps', K.minLaps, 'minLaps');
  el('bop-apply').onchange = ev => {
    const apply = cleaned(K.apply, 'apply', ev.target.value), now = Bop.settingsOf(state.settings), follows = Math.abs(now.remove - now.apply / 2) < 1e-9;
    return save({ [K.apply]: apply, ...(follows ? { [K.remove]: apply / 2 } : {}) });
  };
  number('bop-remove', K.remove, 'remove');
  el('bop-reset').onclick = async () => { await save(Bop.standardSettings()); if (active() && el('rsready').textContent !== 'Could not save') el('bop-msg').textContent = 'Back to the standard settings.'; };
  box.onclick = ev => {
    const b = ev.target.closest && ev.target.closest('button'); if (!b) return;
    const ds = b.dataset || {};
    if (ds.bopPick && choices[ds.bopPick] && choices[ds.bopPick].some(x => x[0] === ds.val)) return save({ [K[ds.bopPick]]: ds.val });
    if (['use', 'rate', 'tank', 'lanes'].includes(ds.bopToggle)) return save({ [K[ds.bopToggle]]: !Bop.settingsOf(state.settings)[ds.bopToggle] });
    if (ds.rail && sections.some(x => x.id === ds.rail)) {
      page.rail = ds.rail; page.open.add(ds.rail);
      const sec = el('bop-section-' + ds.rail); sec.open = true;
      RailForm.sync(el, BopSettings.describe(Bop.settingsOf(state.settings)).rail, null, page.rail);
      if (sec.scrollIntoView) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  sections.forEach(x => {
    const sec = el('bop-section-' + x.id);
    sec.ontoggle = () => {
      if (sec.open) { if (!page.open.has(x.id)) page.rail = x.id; page.open.add(x.id); } else page.open.delete(x.id);
      RailForm.sync(el, BopSettings.describe(Bop.settingsOf(state.settings)).rail, null, page.rail);
    };
  });
}

// ---- the lane controls ----
// o: { eng (the engine, or a function that gives the current one: the race window's, or the one a viewer follows), lanes: [lane numbers (0...)], phase() (the phase of the race screen),
//      send(lane, how) (how: hinder | help | off | auto | accept) }
// Built once; update() only changes what changed, so a button never moves under a finger.
const BopPanel = (() => {
  const BUTTONS = ['hinder', 'help', 'off', 'auto', 'accept'];
  function build(box, o) {
    const getE = () => (typeof o.eng === 'function' ? o.eng() : o.eng);
    box.hidden = false;
    box.innerHTML = `<div class="bophead"><strong>Balance of Power</strong><span class="muted" data-bop="info"></span></div>
      <div class="wrap"><table class="fields boptable"><thead><tr><th>Lane</th><th>Driver</th><th>Now</th><th>Proposed</th><th>Set</th></tr></thead><tbody>${o.lanes.map(l => `<tr data-lane="${l}">
        <td><strong>${l + 1}</strong></td><td data-bop="who"></td><td><span class="bopchip" data-bop="now">BoP off</span> <span class="muted" data-bop="held"></span></td><td data-bop="to"></td>
        <td><div class="tkbtns">${BUTTONS.map(b => `<button class="btn" type="button" data-bop="${b}" aria-label="${b[0].toUpperCase() + b.slice(1)} lane ${l + 1}">${b[0].toUpperCase() + b.slice(1)}</button>`).join('')}</div></td></tr>`).join('')}</tbody></table></div>`;
    const row = l => box.querySelector(`tr[data-lane="${l}"]`);
    box.onclick = ev => {
      const b = ev.target.closest && ev.target.closest('button[data-bop]'); if (!b || b.disabled) return;
      if (b.blur) b.blur();
      const tr = b.closest('tr'); if (tr) o.send(Number(tr.dataset.lane), b.dataset.bop);
    };
    const set = (el, text) => { if (el && el.textContent !== text) el.textContent = text; };
    function update() {
      const v = Bop.view(getE(), o.lanes, o.phase());
      box.hidden = !v.on; if (!v.on) return;
      set(box.querySelector('[data-bop="info"]'), v.info);
      v.rows.forEach(r => {
        const tr = row(r.lane); if (!tr) return;
        tr.hidden = !r.show; if (!r.show) return;
        const q = s => tr.querySelector(`[data-bop="${s}"]`);
        set(q('who'), r.who); set(q('to'), r.to); set(q('held'), r.held ? 'held' : '');
        const chip = q('now'); set(chip, r.now);
        const cls = 'bopchip bop-' + r.kind; if (chip.className !== cls) chip.className = cls;
        BUTTONS.forEach(b => {
          const x = r[b], bt = q(b); if (!bt) return;
          bt.hidden = x.show === false; bt.disabled = x.disabled; set(bt, x.text);
          const pressed = x.on ? 'true' : 'false'; if (bt.getAttribute && bt.getAttribute('aria-pressed') !== pressed && bt.setAttribute) bt.setAttribute('aria-pressed', pressed);
        });
      });
    }
    return { update };
  }
  return { build };
})();
