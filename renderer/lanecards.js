// The lane cards (1.72.0): the Race Director of the Race tab and of the Race Director page (phone, tablet, second computer) as one card for each lane, so that two to four lanes fit on a screen without scrolling.
// A card holds the pads of the lane (penalty points, race time, laps, damage points, championship points) as [−] number [+], the named penalties, the damage incidents, a failure, the Balance of Power and the tyre of the car.
// Above the cards: Undo and the last thing that was done, and the weather. Next to them (2 lanes) or in a drawer (3 lanes or more): the log. On a narrow screen (a phone) only the lane that is picked is shown, with a strip of lanes above it.
// Nothing here has rules of its own: what a button may do comes from the same views as the old folders (Damage.view, Failures.view, Bop.view, Wx.view, the penalty rules of the cars) and what it does goes through the same commands (o.send).
// The old folders (Adjust, Penalties, Balance of Power, Damage, Car Failures) are still there: App Settings > Race Director > "Race Director view" switches between the two (the setting directorView: 'cards' or 'folders').
//
// o: { eng (the engine, or a function that gives the current one), lanes: [lane numbers (0...)], phase() (running, paused, ...), now() (the clock of the screen, as performance.now()), settings() (the pad values: the race setup's own, else the app's),
//      penalty() (is there a penalty system), penaltyTypes() ([{ name, cost }]: the named penalties), champ() (are there championship points), tyre (false: no tyre button, e.g. a Time Token Session),
//      send: { pad(group, lane, amount), assign(lane, typeIndex), damage(lane, points), failure(lane, k) (k -1: at random), failureClear(lane), bop(lane, how), weather(state) },
//      refresh() (draw the page again; default: update), raceKey() (changes with the race or the heat: the picked lane and Undo start again), memory ({ hist, pick, pop, log, key }: kept by a page that builds the cards again),
//      openTyre(lane) (default: open the Tyre Change folder), bind (default true: take the clicks) }
// Built once; update() only changes what changed, so a button never moves under a finger (and what you type in "other" stays).
const LaneCards = (() => {
  const ORDER = ['points', 'time', 'laps', 'damage', 'champ']; // (the order on a card: the same as the drawing)
  const TITLE = { points: 'Penalty points', time: 'Race time', laps: 'Laps', damage: 'Damage points', champ: 'Championship points' };
  const LABEL = { points: 'PENALTY POINTS', time: 'RACE TIME', laps: 'LAPS', damage: 'DAMAGE', champ: 'CHAMPIONSHIP' };
  const DRAWER_FROM = 3; // (from this many lanes the log is a drawer; with fewer it stands next to the cards)

  // the setting: the cards are the standard, 'folders' brings the old folders back
  const on = settings => !(settings && settings.directorView === 'folders');
  const racingOf = phase => phase === 'running' || phase === 'paused';
  const kindOf = k => (k === 'red' || k === 'out' ? 'red' : k === 'amber' || k === 'minor' ? 'amber' : 'ok');
  const fmt = n => AdjustPad.fmt(n);
  const secText = s => `+${Number.isInteger(s) ? s : s.toFixed(1)} s`;
  // the number on the card: points are plain numbers; time, laps and championship points say whether they were added (+) or taken off (−)
  function valueText(g, n) {
    if (g === 'points' || g === 'damage') return String(n);
    const zero = Math.abs(n) < 0.0005;
    return g === 'time' ? (zero ? '0 s' : `${n > 0 ? '+' : '−'}${fmt(Math.abs(n))} s`) : (zero ? '0' : `${n > 0 ? '+' : '−'}${fmt(Math.abs(n))}`);
  }
  // which of the two buttons of a pad do not work now (the same rules as the Adjust folder)
  function padOff(g, c, drow, racing) {
    if (!racing || !c) return { plus: true, minus: true };
    if (g === 'points') return { plus: !!c.dq, minus: !!c.dq || c.points <= 0 };
    if (g === 'damage') return { plus: !drow || !drow.give, minus: !drow || !drow.take };
    return { plus: false, minus: false };
  }

  // ---- what the cards show: worked out from the engine, nothing drawn here (so it can be tested without a page) ----
  // { racing, groups: [the pads that are shown], steps: { group: the amount of the + and − buttons }, usable, wx: { on, info, buttons }, rows: [...], log: html }
  function view(o) {
    const eng = typeof o.eng === 'function' ? o.eng() : o.eng, phase = o.phase(), lanes = o.lanes, S = (o.settings ? o.settings() : null) || {}, t = o.now ? o.now() : 0;
    const racing = racingOf(phase), pen = !!(o.penalty && o.penalty()), canAdj = eng.type === 'race' || eng.type === 'timed', champ = !!(o.champ && o.champ());
    const dv = Damage.view(eng, lanes, t, phase), fv = Failures.view(eng, lanes, t, phase), bv = Bop.view(eng, lanes, phase), wv = Wx.view(eng, phase, t, lanes), tv = Wx.tyreView(eng, phase, lanes);
    const wear = eng.tyrewear && typeof TyreWear !== 'undefined' ? TyreWear.view(eng, lanes, t) : null;
    const types = pen && o.penaltyTypes ? (o.penaltyTypes() || []) : [];
    const groups = ORDER.filter(g => (g === 'points' ? pen : g === 'damage' ? dv.on : g === 'champ' ? canAdj && champ : canAdj));
    const steps = {}; groups.forEach(g => { steps[g] = AdjustPad.valuesOf(S, g)[0]; }); // (the + and − buttons add the first value of the list, the others are in the pop-up)
    const incidents = dv.on ? (dv.incidents && dv.incidents.length ? dv.incidents.map(x => ({ name: x.name, points: x.points })) : [{ name: '', points: 1 }]) : [];
    const rows = lanes.map(lane => {
      const c = eng.cars.find(x => x.lane === lane); if (!c) return { lane, show: false };
      const drow = dv.on ? dv.rows.find(r => r.lane === lane) || null : null, frow = fv.on ? fv.rows.find(r => r.lane === lane) || null : null, brow = bv.on ? bv.rows.find(r => r.lane === lane && r.show) || null : null;
      const trow = tv.rows.find(r => r.lane === lane) || null, wrow = wear ? wear.rows.find(r => r.lane === lane) || null : null;
      const pads = {}; groups.forEach(g => {
        const n = AdjustPanel.valueOf(eng, lane, g), off = padOff(g, c, drow, racing);
        pads[g] = { n, text: g === 'points' && c.dq ? 'DQ' : valueText(g, n), plusOff: off.plus, minusOff: off.minus };
      });
      const sec = pen && eng.penMs ? eng.penMs(c) / 1000 : 0, pend = pen ? (c.pending || []).map(p => p.name) : [];
      const chips = [];
      if (c.dq) chips.push({ t: 'Disqualified', k: 'red' });
      if (sec || pend.length) chips.push({ t: [sec ? secText(sec) : '', pend.length ? `${pend.join(', ')} to serve` : ''].filter(Boolean).join(' · '), k: 'amber' });
      if (drow && (drow.points > 0 || drow.kind !== 'ok')) chips.push({ t: drow.chip, k: kindOf(drow.kind) });
      if (frow && frow.chip !== 'No failure') chips.push({ t: frow.chip, k: kindOf(frow.kind) });
      const kind = chips.some(x => x.k === 'red') ? 'red' : chips.some(x => x.k === 'amber') ? 'amber' : 'ok';
      if (!chips.length) chips.push({ t: 'All clear', k: 'ok' });
      return { lane, show: true, who: c.driverName || `Lane ${lane + 1}`, car: c.carName || '', kind, chips, pads, points: c.points, dq: !!c.dq,
        pen: pen && types.length ? { off: !racing || !!c.dq, items: types.map((ty, ti) => ({ ti, name: ty.name, cost: ty.cost, legacy: ty.effect === undefined, points: ty.points || 0, effect: ty.effect || 'pit', amount: ty.amount || ty.seconds || 0, off: !racing || !!c.dq || (ty.effect === undefined && c.points < ty.cost) })), pending: pend } : null,
        dmg: drow ? { give: racing && !!drow.give, take: !!drow.take, note: drow.note || '', chip: drow.chip } : null,
        fail: frow ? { give: racing && !!frow.give, clear: racing && !!frow.clear, chip: frow.chip, note: frow.note || '' } : null,
        bop: brow ? { now: brow.now, kind: brow.kind, held: !!brow.held, to: brow.to || '', hinder: brow.hinder, help: brow.help, off: brow.off, auto: brow.auto, accept: brow.accept } : null,
        tyre: trow ? { code: trow.code, name: trow.tyre, color: trow.color, pct: wrow ? `${wrow.shown}%` : '' } : null };
    });
    return { racing, groups, steps, incidents, failures: fv.on ? fv.failures : [], usable: !!(groups.length || bv.on || fv.on || wv.on), wx: { on: wv.on, info: wv.info || '', buttons: wv.buttons || [] }, bopInfo: bv.on ? bv.info : '', rows, log: PenaltyPanel.logHtml(eng) };
  }

  // ---- the page ----
  const h = (tag, cls, attrs, kids) => {
    const el = document.createElement(tag); if (cls) el.className = cls;
    if (attrs) Object.keys(attrs).forEach(k => {
      const v = attrs[k]; if (v === false || v === null || v === undefined) return;
      if (k === 'text') el.textContent = v; else if (k === 'hidden' || k === 'disabled') el[k] = !!v; else el.setAttribute(k, v === true ? '' : String(v));
    });
    (kids || []).forEach(x => { if (x) el.appendChild(x); });
    return el;
  };
  const set = (el, text) => { if (el && el.textContent !== text) el.textContent = text; };
  const flag = (el, name, v) => { const s = String(v); if (el.getAttribute(name) !== s) el.setAttribute(name, s); };
  const btn = (cls, text, attrs) => h('button', cls, { type: 'button', text, ...(attrs || {}) });
  // the pop-up of a pad: the amounts of the list as + and − buttons, and a field for any other amount (Give / Take back)
  function amountsPop(g, vals) {
    const gr = AdjustPad.byId(g), row = sign => h('div', 'lc-poprow', null, vals.map(v => btn(`lc-pb ${sign > 0 ? 'lc-pp' : 'lc-pm'}`, `${sign > 0 ? '+' : '−'}${fmt(v)}`, { 'data-pad-do': g, 'data-sign': sign, 'data-v': v, title: `${sign > 0 ? 'Add' : 'Deduct'} ${AdjustPad.unitText(g, v)}` })));
    const other = h('input', 'lc-other', { type: 'number', min: 0, step: gr.whole ? 1 : 'any', placeholder: 'other', 'data-pad-other': g, 'aria-label': `Other amount of ${gr.title.toLowerCase()}` });
    const title = h('strong', null, { text: TITLE[g] }), now = h('span', 'lc-popnow muted');
    const pop = h('div', 'lc-pop lc-amounts', { role: 'dialog', 'data-lc-pop': 'amt:' + g, hidden: true }, [h('div', 'lc-pophead', null, [title, now]), row(1), row(-1),
      h('div', 'lc-poprow lc-popother', null, [other, btn('lc-pb lc-pp lc-give', 'Give', { 'data-pad-do': g, 'data-sign': 1, 'data-other': 1, title: 'Add the amount typed here' }), btn('lc-pb lc-pm lc-take', 'Take back', { 'data-pad-do': g, 'data-sign': -1, 'data-other': 1, title: 'Deduct the amount typed here' })])]);
    return { pop, title, now, other };
  }

  function build(box, o) {
    const getE = () => (typeof o.eng === 'function' ? o.eng() : o.eng), S = () => (o.settings ? o.settings() : (typeof state !== 'undefined' && state.settings) || {});
    const mem = o.memory || {}; if (!mem.hist) mem.hist = AdjustPad.history(); if (mem.pick === undefined) mem.pick = null; if (mem.pop === undefined) mem.pop = null; if (!mem.log) mem.log = false;
    const hist = mem.hist, lanes = o.lanes, when = () => performance.now(), send = o.send || {}, drawer = lanes.length >= DRAWER_FROM;
    const refresh = () => (o.refresh ? o.refresh() : update());
    const opts = () => o;
    let sig = '', cards = [], strip = [], ui = null, logKey = null, lastView = null;
    const cardOf = lane => cards.find(x => x.lane === lane);

    function draw() {
      const s = S(), vals = {}; ORDER.forEach(g => { vals[g] = AdjustPad.valuesOf(s, g); });
      sig = AdjustPad.signature(s); cards = []; strip = [];
      ui = { last: h('span', 'lc-last muted', { 'aria-live': 'polite' }), undo: btn('btn lc-undo', 'Undo', { 'data-lc-undo': 1, title: 'Take the last pad press back' }), wx: h('div', 'lc-wx', { hidden: true }), logBtn: btn('btn lc-logbtn', 'Log ▸', { 'data-lc-logbtn': 1, 'aria-expanded': 'false', title: 'The log of what happened' }),
        stripBox: h('div', 'lc-strip', { role: 'group', 'aria-label': 'Choose a lane' }), cardsBox: h('div', 'lc-cards'), log: h('ol', 'lv-log lc-loglist'), logCount: h('span', 'lc-logn muted'), logBox: null, root: null, wxBtns: [] };
      ui.wxLabel = h('span', 'lc-wxl', { text: 'WEATHER' }); ui.wxSeg = h('div', 'lc-seg', { role: 'group', 'aria-label': 'Weather' }); ui.wx.appendChild(ui.wxLabel); ui.wx.appendChild(ui.wxSeg);
      lanes.forEach(lane => {
        const sb = h('button', 'lc-stripb', { type: 'button', 'data-lc-pick': lane, 'aria-pressed': 'false', hidden: true }), dot = h('i', 'lc-dot'), sn = h('b', null, { text: String(lane + 1) }), sw = h('span', 'lc-stripw');
        sb.appendChild(dot); sb.appendChild(sn); sb.appendChild(sw); ui.stripBox.appendChild(sb); strip.push({ lane, sb, dot, sw });
        const cd = { lane, pad: {}, pops: {} };
        cd.who = h('span', 'lc-who'); cd.car = h('span', 'lc-car muted'); cd.ring = h('i', 'lc-ring'); cd.tpct = h('b', 'lc-tpct');
        cd.tyre = h('button', 'lc-tyre', { type: 'button', 'data-lc-tyre': 1 }, [cd.ring, cd.tpct, h('span', 'lc-caret', { text: '▾' })]);
        cd.chips = h('div', 'lc-chips', { 'aria-live': 'polite' });
        cd.pads = h('div', 'lc-pads');
        ORDER.forEach(g => {
          const p = { cell: h('div', 'lc-pad', { 'data-pad': g, style: AdjustPad.styleOf(g), hidden: true }) }, step = vals[g][0], ap = amountsPop(g, vals[g]);
          p.minus = btn('lc-pm', '−', { 'data-pad-do': g, 'data-sign': -1, 'data-v': step }); p.plus = btn('lc-pp', '+', { 'data-pad-do': g, 'data-sign': 1, 'data-v': step });
          p.val = btn('lc-val', '0', { 'data-lc-open': 'amt:' + g, 'aria-haspopup': 'dialog', 'aria-expanded': 'false' });
          Object.assign(p, { title: ap.title, now: ap.now, other: ap.other, step });
          p.cell.appendChild(h('div', 'lc-padl', { text: LABEL[g] })); p.cell.appendChild(h('div', 'lc-padrow', null, [p.minus, p.val, p.plus])); p.cell.appendChild(ap.pop);
          cd.pad[g] = p; cd.pops['amt:' + g] = { el: ap.pop, opener: p.val }; cd.pads.appendChild(p.cell);
        });
        // the named penalties, the damage incidents and the failures: three buttons that open a pop-up
        cd.acts = h('div', 'lc-acts');
        cd.penB = btn('lc-act lc-act-pen', 'Penalty ▾', { 'data-lc-open': 'pen', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', hidden: true });
        cd.dmgB = btn('lc-act lc-act-dmg', 'Damage ▾', { 'data-lc-open': 'dmg', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', hidden: true });
        cd.failB = btn('lc-act lc-act-fail', 'Failure ▾', { 'data-lc-open': 'fail', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', hidden: true });
        cd.failClr = btn('lc-act lc-act-fail lc-act-clear', 'Clear ✕', { 'data-lc-failclear': 1, hidden: true, title: 'Clear the failure of this car' });
        [cd.penB, cd.dmgB, cd.failB, cd.failClr].forEach(b => cd.acts.appendChild(b));
        cd.penTitle = h('strong'); cd.penNow = h('span', 'lc-popnow muted'); cd.penPend = h('p', 'lc-popnote muted'); cd.penItems = [];
        const penList = h('div', 'lc-poplist'); cd.penPop = h('div', 'lc-pop lc-acts-pop', { role: 'dialog', 'data-lc-pop': 'pen', hidden: true }, [h('div', 'lc-pophead', null, [cd.penTitle, cd.penNow]), h('p', 'lc-popnote muted', { text: 'A named penalty can add points, change the result, or require a pit stop.' }), penList, cd.penPend]);
        cd.penList = penList;
        cd.dmgTitle = h('strong'); cd.dmgNow = h('span', 'lc-popnow muted'); cd.dmgItems = [];
        cd.dmgList = h('div', 'lc-poplist'); cd.dmgPop = h('div', 'lc-pop lc-acts-pop', { role: 'dialog', 'data-lc-pop': 'dmg', hidden: true }, [h('div', 'lc-pophead', null, [cd.dmgTitle, cd.dmgNow]), cd.dmgList]);
        cd.failTitle = h('strong'); cd.failNow = h('span', 'lc-popnow muted'); cd.failRadios = [];
        cd.failList = h('div', 'lc-poplist lc-radios', { role: 'radiogroup', 'aria-label': 'The failure to give' }); cd.failGive = btn('lc-pb lc-give lc-failgive', 'Give', { 'data-lc-failgive': 1 });
        cd.failPop = h('div', 'lc-pop lc-acts-pop', { role: 'dialog', 'data-lc-pop': 'fail', hidden: true }, [h('div', 'lc-pophead', null, [cd.failTitle, cd.failNow]), cd.failList, h('div', 'lc-poprow', null, [cd.failGive])]);
        [cd.penPop, cd.dmgPop, cd.failPop].forEach(p => cd.acts.appendChild(p)); // (the pop-ups hang under the row of buttons)
        cd.pops.pen = { el: cd.penPop, opener: cd.penB }; cd.pops.dmg = { el: cd.dmgPop, opener: cd.dmgB }; cd.pops.fail = { el: cd.failPop, opener: cd.failB };
        // Balance of Power: Hinder, Off, Auto (or Accept), Help
        cd.bopSub = h('span', 'lc-bopsub muted'); cd.bopBtns = {};
        const seg = h('div', 'lc-seg', { role: 'group', 'aria-label': 'Balance of Power' });
        ['hinder', 'off', 'auto', 'accept', 'help'].forEach(k => { const b = btn('lc-segb', k[0].toUpperCase() + k.slice(1), { 'data-lc-bop': k, 'aria-pressed': 'false' }); cd.bopBtns[k] = b; seg.appendChild(b); });
        cd.bop = h('div', 'lc-bop', { hidden: true }, [h('div', 'lc-padl', null, [h('span', null, { text: 'BALANCE OF POWER ' }), cd.bopSub]), seg]);
        cd.el = h('section', 'lc-card', { 'data-lc-lane': lane, 'data-kind': 'ok', 'data-sel': 'false', hidden: true },
          [h('header', 'lc-head', null, [h('span', 'lc-num', { text: String(lane + 1) }), cd.who, cd.car, cd.tyre]), cd.chips, cd.pads, cd.acts, cd.bop]);
        ui.cardsBox.appendChild(cd.el); cards.push(cd);
      });
      ui.logBox = h('aside', 'lc-log', { 'aria-label': 'Log' }, [h('div', 'lc-loghead', null, [h('span', 'lc-padl', { text: 'LOG' }), ui.logCount]), ui.log]);
      ui.root = h('div', 'lc', { 'data-lc-root': 1, 'data-n': lanes.length, 'data-log': drawer ? 'drawer' : 'docked', style: `--n:${lanes.length}` }, [
        h('div', 'lc-bar', null, [h('strong', 'lc-title', { text: 'Race Director' }), ui.last, ui.undo, h('span', 'lc-sp'), ui.wx, ui.logBtn]), ui.stripBox,
        h('div', 'lc-main', null, [ui.cardsBox, ui.logBox])]);
      box.innerHTML = ''; box.appendChild(ui.root); logKey = null;
    }

    // the texts that name the driver (labels for a screen reader, the titles of the pop-ups)
    function names(cd, who) {
      ORDER.forEach(g => { const p = cd.pad[g], u = AdjustPad.unitText(g, p.step);
        p.plus.setAttribute('aria-label', `Add ${u} to ${who}`); p.minus.setAttribute('aria-label', `Deduct ${u} from ${who}`); p.val.setAttribute('aria-label', `Other amounts of ${TITLE[g].toLowerCase()} for ${who}`); set(p.title, `${TITLE[g]} · ${who}`); });
      set(cd.penTitle, `Penalties · ${who}`); set(cd.dmgTitle, `Damage · ${who}`); set(cd.failTitle, `Failure · ${who}`);
      cd.tyre.setAttribute('aria-label', `Change the tyres of ${who}`); cd.penB.setAttribute('aria-label', `Named penalties for ${who}`); cd.dmgB.setAttribute('aria-label', `Damage incidents for ${who}`); cd.failB.setAttribute('aria-label', `Give ${who} a failure`);
      cd.failClr.setAttribute('aria-label', `Clear the failure of ${who}`); cd.named = who;
    }
    // the lists in the pop-ups are made when the race gives them (the penalties of the system, the incidents, the failures): once
    function lists(v) {
      cards.forEach(cd => {
        const pen = v.rows.find(r => r.lane === cd.lane && r.pen);
        if (pen && cd.penItems.length !== pen.pen.items.length) { cd.penList.innerHTML = ''; cd.penItems = pen.pen.items.map(x => { const detail = x.legacy ? `−${x.cost}` : [x.points ? `+${x.points} pt` : '', x.effect === 'time' ? `+${x.amount} s` : x.effect === 'laps' ? `−${x.amount} lap${x.amount === 1 ? '' : 's'}` : x.effect === 'pit' ? `pit ${x.amount} s` : ''].filter(Boolean).join(' · '); const b = btn('lc-pb lc-penb', `${x.name}${detail ? ` (${detail})` : ''}`, { 'data-lc-pen': x.ti, title: x.legacy ? `Costs ${x.cost} penalty points; has to be served in the pits` : 'Give this named penalty immediately' }); cd.penList.appendChild(b); return b; }); }
        if (v.incidents.length && cd.dmgItems.length !== v.incidents.length) { cd.dmgList.innerHTML = ''; cd.dmgItems = v.incidents.map(x => { const b = btn('lc-pb lc-incb', x.name ? `${x.name} +${x.points}` : `+${x.points}`, { 'data-lc-inc': x.points, 'aria-label': `${x.name || 'Damage'}, ${x.points} damage ${x.points === 1 ? 'point' : 'points'}` }); cd.dmgList.appendChild(b); return b; }); }
        if (v.failures.length && cd.failRadios.length !== v.failures.length + 1) {
          cd.failList.innerHTML = '';
          cd.failRadios = [{ k: -1, name: 'At random', chance: '' }, ...v.failures].map((f, i) => {
            const id = `lcf-${cd.lane}-${f.k}`, r = h('input', null, { type: 'radio', name: `lcf-${cd.lane}`, id, value: f.k, 'data-lc-failk': f.k }); if (f.k === -1) r.checked = true;
            cd.failList.appendChild(h('label', 'lc-radio', { for: id }, [r, h('span', null, { text: f.name }), f.chance !== '' ? h('i', 'muted', { text: `${f.chance}%` }) : null])); return r; });
        }
      });
    }

    function update() {
      if (AdjustPad.signature(S()) !== sig) draw();
      const eng = getE(), v = view(opts()); lastView = v;
      const rk = o.raceKey ? o.raceKey() : ''; if (mem.key !== rk) { mem.key = rk; mem.pick = null; mem.pop = null; hist.clear(); }
      const shown = v.rows.filter(r => r.show);
      if (mem.pick === null || !shown.some(r => r.lane === mem.pick)) mem.pick = shown.length ? shown[0].lane : null;
      if (!v.racing) mem.pop = null; // (the controls are off: nothing stays open)
      lists(v); hist.settle((l, g) => AdjustPanel.valueOf(eng, l, g), when());
      set(ui.last, !v.racing ? 'The controls work while the race is running or paused.' : hist.line()); ui.undo.disabled = !v.racing || !hist.canUndo();
      // the weather: the state buttons stand in the bar (the folder keeps the tyres of the cars)
      ui.wx.hidden = !v.wx.on;
      if (v.wx.on) {
        if (ui.wxBtns.length !== v.wx.buttons.length) { ui.wxSeg.innerHTML = ''; ui.wxBtns = v.wx.buttons.map(b => { const x = btn('lc-segb', b.text, { 'data-lc-wx': b.state, 'aria-pressed': 'false' }); ui.wxSeg.appendChild(x); return x; }); }
        v.wx.buttons.forEach((b, i) => { ui.wxBtns[i].disabled = !!b.disabled; flag(ui.wxBtns[i], 'aria-pressed', !!b.on); set(ui.wxBtns[i], b.text); });
        ui.wxSeg.setAttribute('title', v.wx.info);
      }
      cards.forEach(cd => {
        const r = v.rows.find(x => x.lane === cd.lane), sp = strip.find(x => x.lane === cd.lane);
        cd.el.hidden = !r.show; sp.sb.hidden = !r.show; if (!r.show) return;
        if (cd.named !== r.who) names(cd, r.who);
        set(cd.who, r.who); set(cd.car, r.car); set(sp.sw, r.who); flag(cd.el, 'data-kind', r.kind); flag(cd.el, 'data-sel', r.lane === mem.pick); flag(sp.sb, 'aria-pressed', r.lane === mem.pick); flag(sp.dot, 'data-kind', r.kind);
        // the tyre (every race except a Time Token Session)
        cd.tyre.hidden = o.tyre === false || !r.tyre;
        if (r.tyre) { set(cd.ring, r.tyre.code === 'INT' ? 'I' : r.tyre.code); if (cd.ring.style && cd.ring.style.borderColor !== r.tyre.color) cd.ring.style.borderColor = r.tyre.color; set(cd.tpct, r.tyre.pct); cd.tyre.setAttribute('title', `${r.tyre.name}. Opens Tyre Change.`); }
        const ck = JSON.stringify(r.chips); if (cd.chipKey !== ck) { cd.chipKey = ck; cd.chips.innerHTML = ''; r.chips.forEach(x => cd.chips.appendChild(h('span', `lc-chip lc-chip-${x.k}`, { text: x.t }))); }
        ORDER.forEach(g => {
          const p = cd.pad[g], q = r.pads[g]; p.cell.hidden = !q; if (!q) return;
          set(p.val, q.text); p.minus.disabled = q.minusOff; p.plus.disabled = q.plusOff; p.val.disabled = !v.racing; set(p.now, `${q.text} now`);
        });
        // the buttons that open a pop-up
        cd.penB.hidden = !r.pen; if (r.pen) { cd.penB.disabled = r.pen.off; set(cd.penNow, `${r.points} points`); r.pen.items.forEach((x, i) => { if (cd.penItems[i]) cd.penItems[i].disabled = x.off; }); set(cd.penPend, r.pen.pending.length ? `Not served yet: ${r.pen.pending.join(', ')}` : ''); }
        cd.dmgB.hidden = !r.dmg; if (r.dmg) { cd.dmgB.disabled = !r.dmg.give; set(cd.dmgNow, r.dmg.note || r.dmg.chip); cd.dmgItems.forEach(b => { b.disabled = !r.dmg.give; }); }
        cd.failB.hidden = !r.fail || r.fail.clear; cd.failClr.hidden = !(r.fail && r.fail.clear);
        if (r.fail) { cd.failB.disabled = !r.fail.give; cd.failClr.disabled = !r.fail.clear; cd.failGive.disabled = !r.fail.give; cd.failRadios.forEach(x => { x.disabled = !r.fail.give; }); set(cd.failNow, r.fail.note || r.fail.chip); }
        cd.acts.hidden = cd.penB.hidden && cd.dmgB.hidden && cd.failB.hidden && cd.failClr.hidden;
        // Balance of Power
        cd.bop.hidden = !r.bop;
        if (r.bop) {
          set(cd.bopSub, [r.bop.now, r.bop.held ? 'held' : '', r.bop.to ? `→ ${r.bop.to}` : ''].filter(Boolean).join(' · '));
          ['hinder', 'off', 'auto', 'accept', 'help'].forEach(k => { const x = r.bop[k], b = cd.bopBtns[k]; b.hidden = x.show === false; b.disabled = !!x.disabled; set(b, x.text); flag(b, 'aria-pressed', !!x.on); });
        }
      });
      // the log
      if (v.log !== logKey) { logKey = v.log; ui.log.innerHTML = v.log; set(ui.logCount, `${(v.log.match(/<li>/g) || []).length} entries`); }
      applyPop();
      const open = !!mem.log; ui.root.setAttribute('data-logopen', String(open)); flag(ui.logBtn, 'aria-expanded', open); set(ui.logBtn, `Log (${(v.log.match(/<li>/g) || []).length}) ${open ? '▾' : '▸'}`);
    }
    // which pop-up is open (one at a time, on one lane)
    function applyPop() {
      cards.forEach(cd => {
        let any = false;
        Object.keys(cd.pops).forEach(k => { const p = cd.pops[k], open = !!mem.pop && mem.pop.lane === cd.lane && mem.pop.key === k; p.el.hidden = !open; flag(p.opener, 'aria-expanded', open); any = any || open; });
        flag(cd.el, 'data-pop', any);
      });
    }
    const closePop = () => { if (mem.pop) { mem.pop = null; applyPop(); } };
    const laneOf = el => { const c = el.closest ? el.closest('[data-lc-lane]') : null; return c ? Number(c.dataset.lcLane) : null; };
    const unfocus = b => { if (b && b.blur) b.blur(); }; // (so Space and the number keys of the race go on working)

    function press(b) {
      const lane = laneOf(b), pop = b.closest('[data-lc-pop]'); if (b.disabled || lane === null) return;
      const eng = getE(), car = eng.cars.find(c => c.lane === lane), r = AdjustPad.read(b, pop || undefined); if (!r || !car) return;
      hist.push({ lane, group: r.group, amount: r.amount, text: AdjustPad.describe(r.group, r.amount, car.driverName), before: AdjustPanel.valueOf(eng, lane, r.group), at: when() });
      if (send.pad) send.pad(r.group, lane, r.amount);
      unfocus(b); refresh();
    }
    // a click somewhere in the cards (t: the element that was clicked)
    function click(t) {
      if (!t || !t.closest) return;
      let b;
      if ((b = t.closest('[data-lc-pick]'))) { mem.pick = Number(b.dataset.lcPick); mem.pop = null; return refresh(); }
      if ((b = t.closest('[data-lc-undo]'))) { if (!b.disabled && hist.canUndo()) { const u = hist.undo(); if (u && send.pad) send.pad(u.group, u.lane, u.amount); } unfocus(b); return refresh(); }
      if ((b = t.closest('[data-lc-logbtn]'))) { mem.log = !mem.log; unfocus(b); return refresh(); }
      if ((b = t.closest('[data-lc-wx]'))) { if (!b.disabled && send.weather) send.weather(b.dataset.lcWx); unfocus(b); return refresh(); }
      if ((b = t.closest('[data-lc-tyre]'))) { const lane = laneOf(b); closePop(); unfocus(b); if (o.openTyre) o.openTyre(lane); else reveal(typeof document !== 'undefined' ? document : null, 'tyre'); return; }
      if ((b = t.closest('[data-lc-open]'))) {
        if (b.disabled) return; const lane = laneOf(b), k = b.dataset.lcOpen, same = mem.pop && mem.pop.lane === lane && mem.pop.key === k;
        mem.pop = same ? null : { lane, key: k }; unfocus(b); return applyPop();
      }
      if ((b = t.closest('[data-pad-do]'))) return press(b);
      if ((b = t.closest('[data-lc-pen]'))) { if (!b.disabled && send.assign) send.assign(laneOf(b), Number(b.dataset.lcPen)); closePop(); unfocus(b); return refresh(); }
      if ((b = t.closest('[data-lc-inc]'))) { if (!b.disabled && send.damage) send.damage(laneOf(b), Number(b.dataset.lcInc)); closePop(); unfocus(b); return refresh(); }
      if ((b = t.closest('[data-lc-failgive]'))) {
        const cd = cardOf(laneOf(b)), sel = cd && cd.failRadios.find(x => x.checked);
        if (!b.disabled && cd && send.failure) send.failure(cd.lane, sel ? Number(sel.value) : -1);
        closePop(); unfocus(b); return refresh();
      }
      if ((b = t.closest('[data-lc-failclear]'))) { if (!b.disabled && send.failureClear) send.failureClear(laneOf(b)); unfocus(b); return refresh(); }
      if ((b = t.closest('[data-lc-bop]'))) { if (!b.disabled && send.bop) send.bop(laneOf(b), b.dataset.lcBop); unfocus(b); return refresh(); }
      if (!t.closest('[data-lc-pop]')) closePop(); // (a click anywhere else on the cards closes the pop-up)
    }
    // Escape closes the pop-up; Enter in the field "other" gives that amount
    function key(ev) {
      if (!ev || !ev.target) return;
      if (ev.key === 'Escape' && mem.pop) { const opener = (cardOf(mem.pop.lane).pops[mem.pop.key] || {}).opener; closePop(); if (opener && opener.focus) opener.focus(); if (ev.stopPropagation) ev.stopPropagation(); return; }
      if (ev.key === 'Enter' && ev.target.dataset && ev.target.dataset.padOther) {
        const pop = ev.target.closest('[data-lc-pop]'), give = pop && pop.querySelector ? pop.querySelector('[data-pad-do][data-other][data-sign="1"]') : null;
        if (give) { if (ev.preventDefault) ev.preventDefault(); press(give); }
      }
    }
    // a click outside the cards closes the pop-up too (the listener goes by itself when the cards are not on the page any more)
    // (and Escape does too, wherever the focus is: a button that was pressed has let go of it, so the keys of the race keep working)
    let outside = null, escape = null;
    if (typeof document !== 'undefined' && document.addEventListener) {
      outside = ev => { if (box.isConnected === false) return off(); if (mem.pop && ev.target && box.contains && !box.contains(ev.target)) closePop(); };
      escape = ev => { if (box.isConnected === false) return off(); if (ev && ev.key === 'Escape' && mem.pop) closePop(); };
      document.addEventListener('click', outside, true); document.addEventListener('keydown', escape);
    }
    function off() {
      if (typeof document !== 'undefined' && document.removeEventListener) { if (outside) document.removeEventListener('click', outside, true); if (escape) document.removeEventListener('keydown', escape); }
      outside = null; escape = null;
    }

    draw();
    if (o.bind !== false) { box.onclick = ev => click(ev.target); }
    box.onkeydown = key;
    return { update, click, key, draw, view: () => lastView, usable: () => view(opts()).usable, memory: mem, off };
  }

  // open a folder of the page and bring it into view (the tyre button of a card opens Tyre Change)
  function reveal(root, id) {
    if (!root || !root.querySelector) return false;
    const f = root.querySelector(`details[data-dirf="${id}"]`); if (!f) return false;
    f.open = true; if (f.scrollIntoView) f.scrollIntoView({ block: 'nearest' });
    return true;
  }

  return { on, view, build, reveal, valueText, padOff, ORDER, DRAWER_FROM };
})();
