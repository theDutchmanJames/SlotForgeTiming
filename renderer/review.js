// The end-of-race review: after the chequered flag the Race Director checks the result, corrects it and then presses Finalize.
// html() draws the review from an engine (the race's own, or a viewer's copy); apply() carries out one correction on the real engine.
const Review = (() => {
  const ui = { open: new Set(), openStints: new Set(), adjust: new Set(), del: null }; // what is unfolded on screen (not part of the race)
  const fmt = ms => RaceEngine.fmtTime(ms);
  const secs = ms => `${Number.isInteger(ms / 1000) ? ms / 1000 : (ms / 1000).toFixed(1)} s`;

  // The laps of one car, each with what can be done to it.
  // mid: the race is still going on - the newest lap first, and a car that has finished only takes a lap out of the records (the rest is for the review after the race).
  // late(n): the lap was driven after the paid time was up (Time Token Session): it stays invalid.
  // Push and Save (1.54.0): what the pace of a lap did to the wear ("PUSH +0.4%, tyres ×1.35, fuel ×1.22"), or why the lap wore as usual
  function paceTag(c, n) {
    const p = c.ps && c.ps[n]; if (!p || typeof PushSave === 'undefined') return '';
    if (p.p === null || p.p === undefined) return PushSave.whyText(p.w) ? `usual wear: ${PushSave.whyText(p.w)}` : '';
    return [`${PushSave.kindText(p.k)} ${PushSave.pctText(p.p)}`, p.t !== 1 ? `tyres ${PushSave.multText(p.t)}` : '', p.f !== 1 ? `fuel ${PushSave.multText(p.f)}` : ''].filter(Boolean).join(', ');
  }
  function lapListHtml(c, i, mid, late, sc) {
    const order = c.laps.map((_, n) => n); if (mid) order.reverse();
    return `<div class="rv-laps">${order.map(n => {
        const t = c.laps[n], after = !!late && late(n), inv = after || c.invalid.includes(n), rem = c.removed.includes(n), slow = c.bad[n];
        const red = (c.redLaps || []).includes(n);
        const tags = [red ? 'red flag — interrupted lap' : slow ? 'too slow' : '', after ? 'after the time ran out' : inv ? 'invalid' : '', rem ? 'not in the records' : '', (c.yellowFast || []).includes(n) ? (sc ? 'faster than the Safety Car limit' : 'faster than the yellow flag target') : '', paceTag(c, n)].filter(Boolean);
        const del = ui.del === `${i}:${n}` ? `<span class="rv-del">Remove lap ${n + 1}:
            <button class="btn" data-rv="removelap" data-car="${i}" data-lap="${n}" data-recalc="0">From the records only</button>
            ${mid && c.done ? '' : `<button class="btn danger" data-rv="removelap" data-car="${i}" data-lap="${n}" data-recalc="1">From the race too (recalculate)</button>`}
            <button class="btn" data-rv="delcancel">Cancel</button></span>` : `<button class="btn" data-rv="deltry" data-car="${i}" data-lap="${n}">Delete…</button>`;
        return `<div class="rv-lap${inv || rem ? ' rv-bad' : ''}"><span class="num">${n + 1}</span> <span class="rv-t">${fmt(t)}</span> ${tags.map(g => `<small class="muted">${g}</small>`).join(' ')}
          ${after || red ? '' : `<button class="btn" data-rv="invalid" data-car="${i}" data-lap="${n}" data-on="${inv ? 0 : 1}">${inv ? 'Mark valid' : 'Mark invalid'}</button>`} ${del}</div>`;
      }).join('') || '<span class="muted">No laps</span>'}</div>`;
  }

  // The pads to adjust the result of one car (1.12.0): race time (seconds), laps and, in a race with championship points, those points. Each group is a set of [+] value [−] pads
  // (the values are the lists of App Settings > Race Director, and there is a field for another amount); they stack with what was adjusted before.
  const adjustHtml = (c, i, o) => {
    const now = Stats.adjustedText({ adjMs: c.adjMs, adjLaps: c.adjLaps, adjPoints: c.adjPoints });
    return `<div class="rv-adj"><strong>Adjust the result of ${esc(c.driverName)}</strong> <span class="muted">${now ? `adjusted now: ${esc(now)}` : 'nothing adjusted yet'}</span>
      <div class="rv-pads">${AdjustPad.padsHtml(o.settings, { groups: o.champ ? ['time', 'laps', 'champ'] : ['time', 'laps'], attrs: `data-rv="adjust" data-car="${i}"`, who: c.driverName })}</div>
      ${now ? `<button class="btn" data-rv="adjustreset" data-car="${i}">Reset adjustments</button>` : ''}</div>`;
  };

  // Sectors (1.66.0): a car that did not finish says in which sector of the track it was last seen (a dropdown), and two cars in the same sector with the same laps can be put in order (the small arrows).
  // eng.sectors is { count, names } when the track has sectors; with none chosen the order is how it was: who crossed the line first.
  const secLive = c => !c.done && !c.retired && !c.dq;
  function sectorRowHtml(eng, c, i, cols) {
    const sec = eng.sectors; if (!sec || !secLive(c)) return '';
    const name = esc(c.driverName), group = eng.sectorGroup ? eng.sectorGroup(i) : [], at = group.indexOf(i);
    const options = Array.from({ length: sec.count }, (_, k) => `<option value="${k + 1}"${c.sector === k + 1 ? ' selected' : ''}>${esc(Distance.sectorLabel(sec, k + 1))}</option>`).join('');
    const arrow = (dir, label, off) => `<button class="btn rv-arrow" data-rv="sectormove" data-car="${i}" data-dir="${dir}" aria-label="${label}" title="${label}"${off ? ' disabled' : ''}>${dir < 0 ? '\u25b2' : '\u25bc'}</button>`;
    const other = k => (k >= 0 && k < group.length ? esc(eng.cars[group[k]].driverName) : '');
    const arrows = group.length < 2 ? '' : ` <span class="rv-order">${arrow(-1, at > 0 ? `Put ${name} ahead of ${other(at - 1)}` : `${name} is first of the cars in this sector`, at <= 0)}${arrow(1, at < group.length - 1 ? `Put ${name} behind ${other(at + 1)}` : `${name} is last of the cars in this sector`, at >= group.length - 1)}</span> <small class="muted">${group.length} cars in this sector with ${eng.lapsOf(c)} laps</small>`;
    const controls = `<label>Last seen in <select data-rvs="${i}" aria-label="Sector where ${name} was last seen"><option value="">not set: the car that crossed the line first</option>${options}</select></label>${arrows}`;
    return cols ? `<tr class="rv-sub rv-sector"><td></td><td colspan="${cols - 1}">${controls}</td></tr>` : `<div class="rfinish-sector">${controls}</div>`;
  }

  // o.champ: { on, list } when the race gives championship points (a heat race decided on points): they can be adjusted, and the points of the place are shown
  function html(eng, o = {}) {
    const st = eng.standings(), on = eng.penalty && eng.penalty.on, canAdjust = eng.type === 'race' || eng.type === 'timed', champ = canAdjust && !!o.champ && !!o.champ.on, cols = 6 + (champ ? 1 : 0);
    const cup = Icons.trophy({ size: 16 }), wins = x => Stats.isWinner({ sessionType: eng.type }, { pos: x.pos, dq: x.car.dq, retired: x.car.retired, laps: eng.lapsOf(x.car) }); // (the winner of the race or heat: practice and qualifying have none)
    const rows = st.map(x => {
      const c = x.car, i = x.index, pen = eng.penMs(c), name = esc(c.driverName);
      const adjText = Stats.adjustedText({ adjMs: c.adjMs, adjLaps: c.adjLaps, adjPoints: c.adjPoints }), adjMs = c.adjMs || 0, bopNote = eng.bopNoteOf ? eng.bopNoteOf(i) : '', damageNote = eng.damageNoteOf ? eng.damageNoteOf(i) : '', failureNote = eng.failureNoteOf ? eng.failureNoteOf(i) : '', tyreNote = eng.tyreNoteOf ? eng.tyreNoteOf(i) : ''; // (what Balance of Power and the tyres did to the car)
      const timeCell = c.dq ? '<strong>DQ</strong>' : `<strong>${fmt(c.total + pen + adjMs)}</strong>${pen ? `<br><small class="muted">includes +${fmt(pen)}</small>` : ''}`;
      const pending = c.pending.map((p, k) => `<tr class="rv-sub"><td></td><td colspan="${cols - 1}">⚠ <strong>${esc(p.name)}</strong> was not served.
          Add <input type="number" min="0" step="any" class="rv-sec" data-rvt="${i}:${k}" value="${p.unserved}" aria-label="Seconds to add for ${esc(p.name)}"> s
          <button class="btn" data-rv="addtime" data-car="${i}" data-k="${k}">Add time</button>
          ${c.dq ? '' : `<button class="btn danger" data-rv="dq" data-car="${i}" data-k="${k}">Disqualify</button>`}
          <button class="btn" data-rv="forgive" data-car="${i}" data-k="${k}">Forgive</button></td></tr>`).join('');
      const secRow = sectorRowHtml(eng, c, i, cols);
      const open = ui.open.has(i);
      const laps = !open ? '' : `<tr class="rv-sub"><td></td><td colspan="${cols - 1}">${lapListHtml(c, i, false, null, !!eng.safetyCar)}</td></tr>`;
      const adjOpen = canAdjust && ui.adjust.has(i), adjRow = !adjOpen ? '' : `<tr class="rv-sub"><td></td><td colspan="${cols - 1}">${adjustHtml(c, i, { champ, settings: o.settings })}</td></tr>`;
      const lapsCell = `${eng.lapsOf(c)}${c.adjLaps ? `<br><small class="muted">${c.laps.length} driven</small>` : ''}`;
      const pointsCell = !champ ? '' : `<td class="num rv-champ">${((o.champ.list || [])[x.pos - 1] || 0) + (c.adjPoints || 0)}</td>`;
      return `<tr><td>${x.pos}</td><td>${wins(x) ? cup + ' ' : ''}${name}${c.dq ? ' <span class="muted">(disqualified)</span>' : c.retired ? ` <span class="muted">(${c.dmgOut ? 'out by damage' : c.failOut ? 'out by a failure' : 'out'})</span>` : ''}${adjText ? `<br><small class="muted">adjusted: ${esc(adjText)}</small>` : ''}${bopNote ? `<br><small class="muted">Balance of Power: ${esc(bopNote)}</small>` : ''}${tyreNote ? `<br><small class="muted">Tyres: ${esc(tyreNote)}</small>` : ''}${damageNote ? `<br><small class="muted">Damage: ${esc(damageNote)}</small>` : ''}${failureNote ? `<br><small class="muted">Failures: ${esc(failureNote)}</small>` : ''}</td><td class="num">${lapsCell}</td>
        <td class="num">${timeCell}</td>${pointsCell}<td>${on ? `${c.points} pts${pen ? ` · ${secs(pen)}` : ''}${c.pending.length ? ` · ${c.pending.length} not served` : ''}` : ''}</td>
        <td class="actions">${on && c.points ? `<button class="btn" data-rv="nullify" data-car="${i}">Clear points</button> ` : ''}${on && c.undoPoints ? `<button class="btn" data-rv="restorepoints" data-car="${i}">Restore (${c.undoPoints} pts)</button> ` : ''}${c.dq ? `<button class="btn" data-rv="undq" data-car="${i}">Reinstate</button>` : `<button class="btn" data-rv="dq" data-car="${i}">Disqualify</button>`}
        ${canAdjust ? `<button class="btn" data-rv="adjopen" data-car="${i}" aria-expanded="${adjOpen}" title="Add or take off race time, laps${champ ? ' or championship points' : ''}">${adjOpen ? 'Hide adjust' : 'Adjust'}</button> ` : ''}<button class="btn" data-rv="laps" data-car="${i}" aria-expanded="${open}">${open ? 'Hide laps' : 'Laps'}</button></td></tr>${secRow}${pending}${adjRow}${laps}`;
    }).join('');
    const secNote = eng.sectors && eng.cars.some(secLive) ? `<p class="muted rv-secnote">Sectors: for every car that did not finish, choose the sector of the track where it was last seen. Of two cars with the same laps the one in the later sector ranks higher, and with the same sector you can put one ahead with the arrows. A car with no sector ranks behind the others with the same laps, in the order they crossed the line.</p>` : '';
    return `<h3>Race review</h3><p class="muted">The race is over. Check the result and fix it if needed, then press Finalize to save it. Nothing is saved before that.</p>${secNote}
      <div class="wrap"><table class="fields rv-table"><thead><tr><th>Pos</th><th>Driver</th><th>Laps</th><th>Time</th>${champ ? '<th class="rv-champ">Points</th>' : ''}<th>${on ? 'Penalties' : ''}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="row"><button class="btn primary" data-rv="finalize">Finalize results</button> <button class="btn danger" data-rv="discard" title="Nothing from this race is saved in the database">Delete all data</button></div>`;
  }

  // The main computer gets a proper finishing desk, rather than the long table at
  // the bottom of the race controls.  It deliberately uses the very same commands
  // as html(): this is only a clearer presentation of the authoritative review.
  function finishHtml(eng, o = {}) {
    const st = eng.standings(), on = eng.penalty && eng.penalty.on, canAdjust = eng.type === 'race' || eng.type === 'timed', champ = canAdjust && !!o.champ && !!o.champ.on;
    const wins = x => Stats.isWinner({ sessionType: eng.type }, { pos: x.pos, dq: x.car.dq, retired: x.car.retired, laps: eng.lapsOf(x.car) });
    const card = x => {
      const c = x.car, i = x.index, open = ui.open.has(i), adjOpen = canAdjust && ui.adjust.has(i), pen = eng.penMs(c), total = c.total + pen + (c.adjMs || 0);
      const redCount = (c.redLaps || []).filter(n => !c.removed.includes(n)).length;
      const state = c.dq ? 'Disqualified' : c.retired ? 'Out' : wins(x) ? 'Winner' : `Position ${x.pos}`;
      const redNotice = redCount ? `<p class="rfinish-alert"><strong>Red-flag interruption</strong> · ${redCount} ${redCount === 1 ? 'lap is' : 'laps are'} invalid and excluded from records.</p>` : '';
      const pending = c.pending.map((p, k) => `<div class="rfinish-pending">⚠ <strong>${esc(p.name)}</strong> was not served. Add <input type="number" min="0" step="any" class="rv-sec" data-rvt="${i}:${k}" value="${p.unserved}" aria-label="Seconds to add for ${esc(p.name)}"> s <button class="btn" data-rv="addtime" data-car="${i}" data-k="${k}">Add time</button>${c.dq ? '' : ` <button class="btn danger" data-rv="dq" data-car="${i}" data-k="${k}">Disqualify</button>`} <button class="btn" data-rv="forgive" data-car="${i}" data-k="${k}">Forgive</button></div>`).join('');
      const sector = sectorRowHtml(eng, c, i, 0);
      const adjusted = Stats.adjustedText({ adjMs: c.adjMs, adjLaps: c.adjLaps, adjPoints: c.adjPoints });
      return `<article class="rfinish-card${wins(x) ? ' winner' : ''}${c.dq ? ' dq' : ''}">
        <div class="rfinish-cardhead"><span class="rfinish-place">${c.dq ? 'DQ' : x.pos}</span><div><strong>${wins(x) ? Icons.trophy({ size: 20 }) + ' ' : ''}${esc(c.driverName)}</strong><span class="muted">Lane ${c.lane + 1}${c.carName ? ` · ${esc(c.carName)}` : ''}</span></div><span class="rfinish-state">${esc(state)}</span></div>
        ${redNotice}<div class="rfinish-stats"><div><span>Laps</span><strong>${eng.lapsOf(c)}</strong></div><div><span>Total</span><strong>${c.dq ? 'DQ' : fmt(total)}</strong></div><div><span>Best legal lap</span><strong>${c.best === null || c.best === undefined ? '–' : fmt(c.best)}</strong></div>${champ ? `<div><span>Championship points</span><strong>${((o.champ.list || [])[x.pos - 1] || 0) + (c.adjPoints || 0)}</strong></div>` : ''}${on ? `<div><span>Penalties</span><strong>${c.points || 0} pts</strong></div>` : ''}</div>
        ${adjusted ? `<p class="muted">adjusted: ${esc(adjusted)}</p>` : ''}${sector}${pending}<div class="rfinish-actions">${on && c.points ? `<button class="btn" data-rv="nullify" data-car="${i}">Clear points</button>` : ''}${on && c.undoPoints ? `<button class="btn" data-rv="restorepoints" data-car="${i}">Restore points</button>` : ''}${c.dq ? `<button class="btn" data-rv="undq" data-car="${i}">Reinstate driver</button>` : `<button class="btn danger" data-rv="dq" data-car="${i}">Disqualify driver</button>`}${canAdjust ? `<button class="btn" data-rv="adjopen" data-car="${i}" aria-expanded="${adjOpen}">${adjOpen ? 'Hide adjustments' : 'Adjust result'}</button>` : ''}<button class="btn" data-rv="laps" data-car="${i}" aria-expanded="${open}">${open ? 'Hide laps' : 'Review laps'}${redCount ? ` (${redCount} red-flag ${redCount === 1 ? 'lap' : 'laps'})` : ''}</button></div>
        ${adjOpen ? `<div class="rfinish-detail">${adjustHtml(c, i, { champ, settings: o.settings })}</div>` : ''}${open ? `<div class="rfinish-detail"><h4>Laps</h4>${lapListHtml(c, i, false, null, !!eng.safetyCar)}</div>` : ''}
      </article>`;
    };
    const pending = st.reduce((n, x) => n + x.car.pending.length, 0), invalid = eng.cars.reduce((n, c) => n + new Set([...c.invalid, ...c.removed]).size, 0);
    return `<section class="rfinish"><header class="rfinish-head"><div><p class="eyebrow">DIRECTOR'S FINAL CHECK</p><h2>Finalize race results</h2><p class="muted">Review the classification, laps and penalties. Nothing is saved until you finalize.</p></div><div class="rfinish-headactions"><span class="rfinish-check">${invalid ? `${invalid} lap${invalid === 1 ? '' : 's'} marked` : 'All laps checked'}${pending ? ` · ${pending} penalty${pending === 1 ? '' : 'ies'} waiting` : ''}</span><button class="btn primary" data-rv="finalize">Finalize results</button><button class="btn danger" data-rv="discard">Delete all data</button></div></header><div class="rfinish-grid">${st.map(card).join('')}</div><footer class="rfinish-foot"><button class="btn primary" data-rv="finalize">Finalize results</button><button class="btn danger" data-rv="discard">Delete all data</button></footer></section>`;
  }

  // During the race (any session type): the laps of every car, to mark a lap invalid or take it out. The review after the race stays as it is.
  // o.late(car, lap): see lapListHtml. Corrections go to the race as the same operations as in the review after the race.
  function lapsHtml(eng, o = {}) {
    const cars = eng.cars.map((c, i) => ({ c, i })).sort((a, b) => a.c.lane - b.c.lane);
    const blocks = cars.map(({ c, i }) => {
      const open = ui.open.has(i), last = c.laps.length ? fmt(c.laps[c.laps.length - 1]) : '–', best = c.best === null || c.best === undefined ? '–' : fmt(c.best);
      return `<div class="rv-car"><div class="rv-head"><strong>Lane ${c.lane + 1}</strong> <span>${esc(c.driverName)}${c.dq ? ' <span class="muted">(disqualified)</span>' : ''}</span>
          <span class="muted rv-sum">${c.laps.length} ${c.laps.length === 1 ? 'lap' : 'laps'} · last ${last} · best ${best}</span>
          <button class="btn" data-rv="laps" data-car="${i}" aria-expanded="${open}">${open ? 'Hide laps' : 'Laps'}</button></div>
        ${open ? lapListHtml(c, i, true, o.late ? n => o.late(i, n) : null, !!eng.safetyCar) : ''}</div>`;
    }).join('');
    return `<h3>Review laps</h3><p class="muted">Mark a lap invalid, or take it out of the records, while the race goes on. The newest lap is on top. The review after the race stays.</p>
      <div class="rv-cars">${blocks}</div>`;
  }

  // the time bought, as words: 5 min, 2 min 30 s
  const boughtText = ms => { const sec = Math.round(Number(ms) / 1000); if (!Number.isFinite(sec)) return ''; const m = Math.floor(sec / 60), r = sec % 60; return !r ? `${m} min` : m ? `${m} min ${r} s` : `${r} s`; };
  const STINT_END = { expired: 'Time ran out', cleared: 'Lane switched off', driver: 'Driver changed', session: 'Session ended' };
  const stintLapsHtml = s => `<div class="rv-laps">${s.laps.map((l, n) => {
      const inv = !!l.late || !!l.invalid, rem = !!l.removed;
      const tags = [l.bad ? 'too slow' : '', l.late ? 'after the time ran out' : l.invalid ? 'invalid' : '', rem ? 'not in the records' : ''].filter(Boolean);
      const del = ui.del === `s${s.id}:${n}` ? `<span class="rv-del">Remove lap ${n + 1}:
          <button class="btn" data-rv="tkremove" data-sid="${s.id}" data-lap="${n}" data-recalc="0">From the records only</button>
          <button class="btn danger" data-rv="tkremove" data-sid="${s.id}" data-lap="${n}" data-recalc="1">From the stint too</button>
          <button class="btn" data-rv="delcancel">Cancel</button></span>` : `<button class="btn" data-rv="deltry" data-sid="${s.id}" data-lap="${n}">Delete…</button>`;
      return `<div class="rv-lap${inv || rem ? ' rv-bad' : ''}"><span class="num">${n + 1}</span> <span class="rv-t">${fmt(l.t)}</span> ${tags.map(g => `<small class="muted">${g}</small>`).join(' ')}
        ${l.late ? '' : `<button class="btn" data-rv="tkinvalid" data-sid="${s.id}" data-lap="${n}" data-on="${inv ? 0 : 1}">${inv ? 'Mark valid' : 'Mark invalid'}</button>`} ${del}</div>`;
    }).join('') || '<span class="muted">No laps</span>'}</div>`;

  // The review at the end of a Time Token Session: every stint (one driver's run on one lane) with its laps. Nothing is saved before Finalize.
  function stintsHtml(list, o = {}) {
    const rows = list.map(s => {
      const who = s.who || {}, counted = s.laps.filter(l => !l.late), lateN = s.laps.length - counted.length, open = ui.openStints.has(s.id);
      return `<tr><td>${s.lane + 1}</td><td>${esc(who.driverName || 'Guest')}${who.carName ? `<br><small class="muted">${esc(who.carName)}</small>` : ''}</td><td class="num">${boughtText(s.bought)}</td>
        <td class="num">${counted.length}${lateN ? `<br><small class="muted">+${lateN} after the time</small>` : ''}</td><td class="num">${s.best === null || s.best === undefined ? '–' : fmt(s.best)}</td><td>${esc(STINT_END[s.closedBy] || '')}</td>
        <td class="actions"><button class="btn" data-rv="laps" data-sid="${s.id}" aria-expanded="${open}">${open ? 'Hide laps' : 'Laps'}</button></td></tr>
        ${open ? `<tr class="rv-sub"><td></td><td colspan="6">${stintLapsHtml(s)}</td></tr>` : ''}`;
    }).join('');
    return `<h3>Session review</h3><p class="muted">The session is over. Check the stints and fix the laps if needed, then press Finalize to save them as Token Records. Nothing is saved before that.</p>
      <div class="wrap"><table class="fields rv-table"><thead><tr><th>Lane</th><th>Driver</th><th>Time bought</th><th>Laps</th><th>Best lap</th><th>Ended</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      ${o.failed ? `<p class="muted" role="alert">${esc(o.failed)}</p>` : ''}
      <div class="row"><button class="btn primary" data-rv="finalize">Finalize results</button> <button class="btn danger" data-rv="discard" data-what="session" title="Nothing from this session is saved in the database">Delete all data</button></div>`;
  }

  // Clicks on a review panel. Corrections go to send({op, ...}); unfolding things is only on screen, so redraw() does that.
  function bind(root, send, redraw) {
    root.onchange = ev => { // (1.66.0) the sector where a car that did not finish was last seen
      const sel = ev.target && ev.target.closest ? ev.target.closest('[data-rvs]') : null; if (!sel) return;
      send({ op: 'sector', car: Number(sel.dataset.rvs), sector: sel.value === '' ? null : Number(sel.value) });
    };
    root.onclick = ev => {
      const b = ev.target && ev.target.closest ? ev.target.closest('[data-rv]') : null; if (!b || b.disabled) return;
      const d = b.dataset, op = d.rv, car = d.car === undefined ? undefined : Number(d.car), sid = d.sid === undefined ? undefined : Number(d.sid);
      if (op === 'discard' && !confirm(d.what === 'session'
        ? 'Delete all data of this session?\n\nNo stint is recorded in the database: no laps, no results, no Token Records.\n\nThis can\'t be undone.'
        : 'Delete all data of this race?\n\nNothing is recorded in the database: no laps, no results, no records. In a heat race this includes the earlier heats.\n\nThis can\'t be undone.')) return;
      if (op === 'adjopen') { if (ui.adjust.has(car)) ui.adjust.delete(car); else ui.adjust.add(car); return redraw(); }
      if (op === 'adjust') { // a pad: add or deduct its value (or what is typed in the field of that pad)
        const r = AdjustPad.read(b); if (!r) return; // (an empty field, zero, a minus sign or text: nothing to do)
        return send({ op, car, ms: r.group === 'time' ? Math.round(r.amount * 1000) : undefined, laps: r.group === 'laps' ? r.amount : undefined, points: r.group === 'champ' ? r.amount : undefined });
      }
      if (op === 'laps') { const set = sid === undefined ? ui.open : ui.openStints, key = sid === undefined ? car : sid; if (set.has(key)) set.delete(key); else set.add(key); return redraw(); }
      if (op === 'deltry') { ui.del = sid === undefined ? `${car}:${d.lap}` : `s${sid}:${d.lap}`; return redraw(); }
      if (op === 'delcancel') { ui.del = null; return redraw(); }
      if (op === 'addtime') {
        const inp = root.querySelector(`[data-rvt="${car}:${d.k}"]`), s = Number(inp && inp.value);
        send({ op, car, ms: Math.round((Number.isFinite(s) ? s : 0) * 1000) });
        return send({ op: 'forgive', car, k: Number(d.k) }); // the penalty is settled
      }
      if (op === 'removelap' || op === 'tkremove') ui.del = null;
      send({ op, car, sid, k: d.k === undefined ? undefined : Number(d.k), lap: d.lap === undefined ? undefined : Number(d.lap), on: d.on === '1', recalc: d.recalc === '1', ...(d.dir === undefined ? {} : { dir: Number(d.dir) }) });
    };
  }

  // a new race or session: nothing is unfolded yet
  function reset() { ui.open.clear(); ui.openStints.clear(); ui.adjust.clear(); ui.del = null; }

  // one correction on the real engine; true when something changed
  function apply(eng, c) {
    switch (c.op) {
      case 'nullify': return eng.nullify(c.car);
      case 'restorepoints': return eng.restorePoints(c.car);
      case 'forgive': return eng.forgive(c.car, c.k);
      case 'addtime': return eng.addTime(c.car, c.ms);
      case 'adjust': return Number.isInteger(c.car) && eng.adjust(c.car, { ms: c.ms, laps: c.laps, points: c.points });
      case 'adjustreset': return Number.isInteger(c.car) && eng.adjustReset(c.car);
      case 'dq': return eng.setDq(c.car, true);
      case 'undq': return eng.setDq(c.car, false);
      case 'invalid': return eng.setInvalid(c.car, c.lap, !!c.on);
      case 'removelap': return eng.removeLap(c.car, c.lap, !!c.recalc);
      case 'sector': return Number.isInteger(c.car) && eng.setSector(c.car, c.sector);
      case 'sectormove': return Number.isInteger(c.car) && eng.moveSector(c.car, c.dir);
    }
    return false;
  }
  return { html, finishHtml, lapsHtml, stintsHtml, bind, apply, reset, boughtText, ui };
})();
if (typeof module !== 'undefined') module.exports = Review;
