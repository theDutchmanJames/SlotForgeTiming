// The penalty panel (1.15.0): the table of points and penalties for each lane (points, time penalty, penalties still to be served, the buttons) and the log of what happened.
// One piece for both places, so they look and work the same: the Penalties folder of the Race Director page (it sends the buttons to the race window) and the Penalties folder of the Race tab (it gives the penalty itself).
// The table is made once and then only updated (tableHtml + refresh), so a button never changes under your finger. The buttons carry data-cmd / data-lane / data-n / data-type, as the Race Director page always did.
// build(box, o): o = { eng (the engine or a function that gives it), entries: [{ lane, driverName }] (or a function that gives them),  cfg() (the penalty system: { on, types }), phase(), send({ type: 'penalty'|'assign', lane, n | typeIndex }), bind (default true) }
const PenaltyPanel = (() => {
  const esc = x => String(x).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  // the table: a row for each lane, with the buttons -1, Penalty point +1 and one for each penalty of the system
  const tableHtml = (entries, types) => `<div class="wrap"><table class="fields"><thead><tr><th>Lane</th><th>Driver</th><th>Points</th><th>Time penalty</th><th>Not served yet</th><th></th></tr></thead><tbody>${entries.map(e =>
    `<tr data-row="${e.lane}"><td>${e.lane + 1}</td><td>${esc(e.driverName)}</td><td class="num dir-pts"></td><td class="num dir-sec"></td><td class="dir-pend"></td>
     <td class="actions"><button class="btn" data-cmd="penalty" data-lane="${e.lane}" data-n="-1" aria-label="Take back a point from ${esc(e.driverName)}">−1</button> <button class="btn danger" data-cmd="penalty" data-lane="${e.lane}" data-n="1">Penalty point +1</button>
     ${(types || []).map((t, ti) => `<button class="btn" data-cmd="assign" data-lane="${e.lane}" data-type="${ti}" title="Costs ${t.cost} penalty points; has to be served in the pits">${esc(t.name)} (−${t.cost})</button>`).join(' ')}</td></tr>`).join('')}</tbody></table></div>
    <h3>Penalty log</h3><ol id="dir-log" class="lv-log"></ol>`;
  const NONE = '<p class="muted">This race has no penalty system. Choose one in the race setup to give penalty points.</p>';
  // the log: the last twelve things that happened, the newest first
  const logHtml = eng => {
    const log = (eng.events || []).filter(x => ['penalty', 'disqualified', 'reinstated', 'assigned', 'served', 'leftearly', 'forgiven', 'timeadded', 'damage', 'repaired', 'repairearly', 'damagelate', 'damageout', 'failure', 'failurerepaired', 'failureearly', 'failurelate', 'failureout', 'failurecleared', 'mandatory'].includes(x.type) && !(x.type === 'mandatory' && x.ok)).slice(-12).reverse(); // (a mandatory stop that was kept is not news)
    return log.length ? log.map(x => { const c = eng.cars[x.car], who = esc(c ? c.driverName : '?');
      return `<li>${x.type === 'penalty' ? `${who}: ${x.delta > 0 ? '+' : ''}${x.delta} point${Math.abs(x.delta) === 1 ? '' : 's'} (now ${x.points}${x.ms ? ', +' + x.ms / 1000 + ' s' : ''})` : x.type === 'disqualified' ? `${who} is disqualified` : x.type === 'reinstated' ? `${who} is back in the race` : x.type === 'assigned' ? `${who} must serve: ${esc(x.name)}` : x.type === 'served' ? `${who} served: ${esc(x.name)}` : x.type === 'leftearly' ? `${who} left too early (${esc(x.name)})${x.extra ? `, +${x.extra} point${x.extra === 1 ? '' : 's'}` : ''}` : x.type === 'forgiven' ? `${who}: ${esc(x.name)} forgiven` : x.type === 'damage' ? `${who}: ${x.delta > 0 ? '+' : ''}${x.delta} damage point${Math.abs(x.delta) === 1 ? '' : 's'} (now ${x.points}${x.name ? ', ' + esc(x.name) : ''})${x.why === 'deslot' ? ', a deslot' : ''}` : x.type === 'repaired' ? `${who} repaired: ${esc(x.name)} (${Math.round(x.ms / 100) / 10} s in the pits)` : x.type === 'repairearly' ? `${who} left the pits before the repair was done (${esc(x.name)})${x.extra ? `, +${x.extra} penalty point${x.extra === 1 ? '' : 's'}` : ''}` : x.type === 'damagelate' ? `${who} is late for the pits (${esc(x.name)})${x.points ? `, +${x.points} penalty point${x.points === 1 ? '' : 's'}` : ''}` : x.type === 'damageout' ? `${who} is ${x.how === 'dq' ? 'disqualified' : 'retired'} by damage (${esc(x.name)})` : x.type === 'mandatory' ? `${who}: ${esc(TyreWear.mandNote([x], x.car))}` : x.type === 'failure' ? `${who} has a failure: ${esc(x.name)}${x.by === 'director' ? ' (given by the Race Director)' : ''}` : x.type === 'failurecleared' ? `${who}: failure cleared by the Race Director (${esc(x.name)})` : x.type === 'failurerepaired' ? `${who} repaired: ${esc(x.name)} (${Math.round(x.ms / 100) / 10} s in the pits)` : x.type === 'failureearly' ? `${who} left the pits before the failure was cleared (${esc(x.name)})${x.extra ? `, +${x.extra} penalty point${x.extra === 1 ? '' : 's'}` : ''}` : x.type === 'failurelate' ? `${who} is late for the pits (${esc(x.name)})${x.points ? `, +${x.points} penalty point${x.points === 1 ? '' : 's'}` : ''}` : x.type === 'failureout' ? `${who} is ${x.how === 'dq' ? 'disqualified' : 'retired'} by a failure (${esc(x.name)})` : `${who}: +${x.ms / 1000} s added`}</li>`; }).join('') : '<li class="muted">No penalties yet.</li>';
  };
  // the numbers and the buttons of the rows (root: the element with the table in it; on: the race runs or is paused)
  const refresh = (root, eng, entries, types, on) => {
    entries.forEach(e => {
      const row = root.querySelector(`[data-row="${e.lane}"]`), c = eng.cars.find(x => x.lane === e.lane); if (!row || !c) return;
      row.querySelector('.dir-pts').textContent = c.dq ? 'DQ' : String(c.points);
      const sec = eng.penMs(c) / 1000; row.querySelector('.dir-sec').textContent = sec ? `+${Number.isInteger(sec) ? sec : sec.toFixed(1)} s` : '–';
      row.querySelector('[data-n="1"]').disabled = !on || c.dq;
      row.querySelector('[data-n="-1"]').disabled = !(on && c.points > 0);
      row.querySelector('.dir-pend').textContent = c.pending.map(p => p.name).join(', ') || '–';
      row.querySelectorAll('[data-cmd="assign"]').forEach(b => { const ty = (types || [])[Number(b.dataset.type)]; b.disabled = !on || c.dq || !ty || c.points < ty.cost; });
    });
  };
  // the panel of the Race tab: the table, the log and the clicks. o.entries may be a function: when the drivers change (the next heat) the table is made again.
  function build(box, o) {
    const getE = () => (typeof o.eng === 'function' ? o.eng() : o.eng), cfg = () => (o.cfg ? o.cfg() : {}) || {}, ents = () => (typeof o.entries === 'function' ? o.entries() : o.entries) || [];
    let sig = null, log = null;
    function draw() {
      const es = ents(); sig = es.map(e => `${e.lane}:${e.driverName}`).join('|');
      box.innerHTML = cfg().on ? tableHtml(es, cfg().types) : NONE;
      log = box.querySelector ? box.querySelector('#dir-log') : null;
    }
    function click(t) {
      const b = t && t.closest ? t.closest('[data-cmd]') : null; if (!b || b.disabled) return;
      const lane = Number(b.dataset.lane);
      if (b.dataset.cmd === 'penalty') o.send({ type: 'penalty', lane, n: Number(b.dataset.n) });
      else if (b.dataset.cmd === 'assign') o.send({ type: 'assign', lane, typeIndex: Number(b.dataset.type) });
    }
    function update() {
      if (!cfg().on) return;
      if (ents().map(e => `${e.lane}:${e.driverName}`).join('|') !== sig) draw();
      const eng = getE(), ph = o.phase(), on = ph === 'running' || ph === 'paused';
      refresh(box, eng, ents(), cfg().types, on);
      const h = logHtml(eng); if (log && log.innerHTML !== h) log.innerHTML = h;
    }
    if (o.bind !== false) box.onclick = ev => click(ev.target);
    draw(); update();
    return { update, click, draw };
  }
  return { build, tableHtml, refresh, logHtml, NONE };
})();
