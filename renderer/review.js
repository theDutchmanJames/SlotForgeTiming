// The end-of-race review: after the chequered flag the Race Director checks the result, corrects it and then presses Finalize.
// html() draws the review from an engine (the race's own, or a viewer's copy); apply() carries out one correction on the real engine.
const Review = (() => {
  const ui = { open: new Set(), openStints: new Set(), del: null }; // what is unfolded on screen (not part of the race)
  const fmt = ms => RaceEngine.fmtTime(ms);
  const secs = ms => `${Number.isInteger(ms / 1000) ? ms / 1000 : (ms / 1000).toFixed(1)} s`;

  // The laps of one car, each with what can be done to it.
  // mid: the race is still going on - the newest lap first, and a car that has finished only takes a lap out of the records (the rest is for the review after the race).
  // late(n): the lap was driven after the paid time was up (Time Token Session): it stays invalid.
  function lapListHtml(c, i, mid, late) {
    const order = c.laps.map((_, n) => n); if (mid) order.reverse();
    return `<div class="rv-laps">${order.map(n => {
        const t = c.laps[n], after = !!late && late(n), inv = after || c.invalid.includes(n), rem = c.removed.includes(n), slow = c.bad[n];
        const tags = [slow ? 'too slow' : '', after ? 'after the time ran out' : inv ? 'invalid' : '', rem ? 'not in the records' : ''].filter(Boolean);
        const del = ui.del === `${i}:${n}` ? `<span class="rv-del">Remove lap ${n + 1}:
            <button class="btn" data-rv="removelap" data-car="${i}" data-lap="${n}" data-recalc="0">From the records only</button>
            ${mid && c.done ? '' : `<button class="btn danger" data-rv="removelap" data-car="${i}" data-lap="${n}" data-recalc="1">From the race too (recalculate)</button>`}
            <button class="btn" data-rv="delcancel">Cancel</button></span>` : `<button class="btn" data-rv="deltry" data-car="${i}" data-lap="${n}">Delete…</button>`;
        return `<div class="rv-lap${inv || rem ? ' rv-bad' : ''}"><span class="num">${n + 1}</span> <span class="rv-t">${fmt(t)}</span> ${tags.map(g => `<small class="muted">${g}</small>`).join(' ')}
          ${after ? '' : `<button class="btn" data-rv="invalid" data-car="${i}" data-lap="${n}" data-on="${inv ? 0 : 1}">${inv ? 'Mark valid' : 'Mark invalid'}</button>`} ${del}</div>`;
      }).join('') || '<span class="muted">No laps</span>'}</div>`;
  }

  function html(eng) {
    const st = eng.standings(), on = eng.penalty && eng.penalty.on;
    const rows = st.map(x => {
      const c = x.car, i = x.index, pen = eng.penMs(c), name = esc(c.driverName);
      const timeCell = c.dq ? '<strong>DQ</strong>' : `<strong>${fmt(c.total + pen)}</strong>${pen ? `<br><small class="muted">includes +${fmt(pen)}</small>` : ''}`;
      const pending = c.pending.map((p, k) => `<tr class="rv-sub"><td></td><td colspan="5">⚠ <strong>${esc(p.name)}</strong> was not served.
          Add <input type="number" min="0" step="any" class="rv-sec" data-rvt="${i}:${k}" value="${p.unserved}" aria-label="Seconds to add for ${esc(p.name)}"> s
          <button class="btn" data-rv="addtime" data-car="${i}" data-k="${k}">Add time</button>
          ${c.dq ? '' : `<button class="btn danger" data-rv="dq" data-car="${i}" data-k="${k}">Disqualify</button>`}
          <button class="btn" data-rv="forgive" data-car="${i}" data-k="${k}">Forgive</button></td></tr>`).join('');
      const open = ui.open.has(i);
      const laps = !open ? '' : `<tr class="rv-sub"><td></td><td colspan="5">${lapListHtml(c, i, false)}</td></tr>`;
      return `<tr><td>${x.pos}</td><td>${name}${c.dq ? ' <span class="muted">(disqualified)</span>' : c.retired ? ' <span class="muted">(out)</span>' : ''}</td><td class="num">${c.laps.length}</td>
        <td class="num">${timeCell}</td><td>${on ? `${c.points} pts${pen ? ` · ${secs(pen)}` : ''}${c.pending.length ? ` · ${c.pending.length} not served` : ''}` : ''}</td>
        <td class="actions">${on && c.points ? `<button class="btn" data-rv="nullify" data-car="${i}">Clear points</button> ` : ''}${on && c.undoPoints ? `<button class="btn" data-rv="restorepoints" data-car="${i}">Restore (${c.undoPoints} pts)</button> ` : ''}${c.dq ? `<button class="btn" data-rv="undq" data-car="${i}">Reinstate</button>` : `<button class="btn" data-rv="dq" data-car="${i}">Disqualify</button>`}
        <button class="btn" data-rv="laps" data-car="${i}" aria-expanded="${open}">${open ? 'Hide laps' : 'Laps'}</button></td></tr>${pending}${laps}`;
    }).join('');
    return `<h3>Race review</h3><p class="muted">The race is over. Check the result and fix it if needed, then press Finalize to save it. Nothing is saved before that.</p>
      <div class="wrap"><table class="fields rv-table"><thead><tr><th>Pos</th><th>Driver</th><th>Laps</th><th>Time</th><th>${on ? 'Penalties' : ''}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="row"><button class="btn primary" data-rv="finalize">Finalize results</button> <button class="btn danger" data-rv="discard" title="Nothing from this race is saved in the database">Delete all data</button></div>`;
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
        ${open ? lapListHtml(c, i, true, o.late ? n => o.late(i, n) : null) : ''}</div>`;
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
    root.onclick = ev => {
      const b = ev.target && ev.target.closest ? ev.target.closest('[data-rv]') : null; if (!b || b.disabled) return;
      const d = b.dataset, op = d.rv, car = d.car === undefined ? undefined : Number(d.car), sid = d.sid === undefined ? undefined : Number(d.sid);
      if (op === 'discard' && !confirm(d.what === 'session'
        ? 'Delete all data of this session?\n\nNo stint is recorded in the database: no laps, no results, no Token Records.\n\nThis can\'t be undone.'
        : 'Delete all data of this race?\n\nNothing is recorded in the database: no laps, no results, no records. In a heat race this includes the earlier heats.\n\nThis can\'t be undone.')) return;
      if (op === 'laps') { const set = sid === undefined ? ui.open : ui.openStints, key = sid === undefined ? car : sid; if (set.has(key)) set.delete(key); else set.add(key); return redraw(); }
      if (op === 'deltry') { ui.del = sid === undefined ? `${car}:${d.lap}` : `s${sid}:${d.lap}`; return redraw(); }
      if (op === 'delcancel') { ui.del = null; return redraw(); }
      if (op === 'addtime') {
        const inp = root.querySelector(`[data-rvt="${car}:${d.k}"]`), s = Number(inp && inp.value);
        send({ op, car, ms: Math.round((Number.isFinite(s) ? s : 0) * 1000) });
        return send({ op: 'forgive', car, k: Number(d.k) }); // the penalty is settled
      }
      if (op === 'removelap' || op === 'tkremove') ui.del = null;
      send({ op, car, sid, k: d.k === undefined ? undefined : Number(d.k), lap: d.lap === undefined ? undefined : Number(d.lap), on: d.on === '1', recalc: d.recalc === '1' });
    };
  }

  // a new race or session: nothing is unfolded yet
  function reset() { ui.open.clear(); ui.openStints.clear(); ui.del = null; }

  // one correction on the real engine; true when something changed
  function apply(eng, c) {
    switch (c.op) {
      case 'nullify': return eng.nullify(c.car);
      case 'restorepoints': return eng.restorePoints(c.car);
      case 'forgive': return eng.forgive(c.car, c.k);
      case 'addtime': return eng.addTime(c.car, c.ms);
      case 'dq': return eng.setDq(c.car, true);
      case 'undq': return eng.setDq(c.car, false);
      case 'invalid': return eng.setInvalid(c.car, c.lap, !!c.on);
      case 'removelap': return eng.removeLap(c.car, c.lap, !!c.recalc);
    }
    return false;
  }
  return { html, lapsHtml, stintsHtml, bind, apply, reset, boughtText, ui };
})();
if (typeof module !== 'undefined') module.exports = Review;
