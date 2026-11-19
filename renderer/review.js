// The end-of-race review: after the chequered flag the Race Director checks the result, corrects it and then presses Finalize.
// html() draws the review from an engine (the race's own, or a viewer's copy); apply() carries out one correction on the real engine.
const Review = (() => {
  const ui = { open: new Set(), openStints: new Set(), adjust: new Set(), del: null, filter: 'all', checked: new Set(), focus: null }; // what is unfolded on screen (not part of the race)
  const fmt = ms => RaceEngine.fmtTime(ms);
  const secs = ms => `${Number.isInteger(ms / 1000) ? ms / 1000 : (ms / 1000).toFixed(1)} s`;

  // The laps of one car, each with what can be done to it.
  // mid: the race is still going on - the newest lap first, and a car that has finished only takes a lap out of the records (the rest is for the review after the race).
  // late(n): the lap was driven after the paid time was up (Time Token Session): it stays invalid.
  // Push and Save (1.54.0): what the pace of a lap did to the wear ("PUSH +0.4%, tyres ×1.35, fuel ×1.22"), or why the lap wore as usual
  function paceTag(c, n) {
    const p = c.ps && c.ps[n];
    if (!p || typeof PushSave === 'undefined') return '';
    if (p.p === null || p.p === undefined) return PushSave.whyText(p.w) ? `usual wear: ${PushSave.whyText(p.w)}` : '';
    return [
      `${PushSave.kindText(p.k)} ${PushSave.pctText(p.p)}`,
      p.t !== 1 ? `tyres ${PushSave.multText(p.t)}` : '',
      p.f !== 1 ? `fuel ${PushSave.multText(p.f)}` : ''
    ]
      .filter(Boolean)
      .join(', ');
  }
  function lapListHtml(c, i, mid, late, sc) {
    const order = c.laps.map((_, n) => n);
    if (mid) order.reverse();
    return `<div class="rv-laps">${
      order
        .map(n => {
          const t = c.laps[n],
            after = !!late && late(n),
            inv = after || c.invalid.includes(n),
            rem = c.removed.includes(n),
            slow = c.bad[n];
          const red = (c.redLaps || []).includes(n);
          const resumed = (c.resumedLaps || []).includes(n);
          const tags = [
            red ? 'red flag — interrupted lap' : resumed ? 'first lap after a pause' : slow ? 'too slow' : '',
            after ? 'after the time ran out' : inv ? 'invalid' : '',
            rem ? 'not in the records' : '',
            (c.yellowFast || []).includes(n) ? (sc ? 'faster than the Safety Car limit' : 'faster than the yellow flag target') : '',
            paceTag(c, n)
          ].filter(Boolean);
          const del =
            ui.del === `${i}:${n}`
              ? `<span class="rv-del">Remove lap ${n + 1}:
            <button class="btn" data-rv="removelap" data-car="${i}" data-lap="${n}" data-recalc="0">From the records only</button>
            ${mid && c.done ? '' : `<button class="btn danger" data-rv="removelap" data-car="${i}" data-lap="${n}" data-recalc="1">From the race too (recalculate)</button>`}
            <button class="btn" data-rv="delcancel">Cancel</button></span>`
              : `<button class="btn" data-rv="deltry" data-car="${i}" data-lap="${n}">Delete…</button>`;
          return `<div class="rv-lap${inv || rem ? ' rv-bad' : ''}"><span class="num">${n + 1}</span> <span class="rv-t">${fmt(t)}</span> ${tags.map(g => `<small class="muted">${g}</small>`).join(' ')}
          ${after || red ? '' : `<button class="btn" data-rv="invalid" data-car="${i}" data-lap="${n}" data-on="${inv ? 0 : 1}">${inv ? 'Mark valid' : 'Mark invalid'}</button>`} ${del}</div>`;
        })
        .join('') || '<span class="muted">No laps</span>'
    }</div>`;
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
    const sec = eng.sectors;
    if (!sec || !secLive(c)) return '';
    const name = esc(c.driverName),
      group = eng.sectorGroup ? eng.sectorGroup(i) : [],
      at = group.indexOf(i);
    const options = Array.from(
      { length: sec.count },
      (_, k) => `<option value="${k + 1}"${c.sector === k + 1 ? ' selected' : ''}>${esc(Distance.sectorLabel(sec, k + 1))}</option>`
    ).join('');
    const arrow = (dir, label, off) =>
      `<button class="btn rv-arrow" data-rv="sectormove" data-car="${i}" data-dir="${dir}" aria-label="${label}" title="${label}"${off ? ' disabled' : ''}>${dir < 0 ? '\u25b2' : '\u25bc'}</button>`;
    const other = k => (k >= 0 && k < group.length ? esc(eng.cars[group[k]].driverName) : '');
    const arrows =
      group.length < 2
        ? ''
        : ` <span class="rv-order">${arrow(-1, at > 0 ? `Put ${name} ahead of ${other(at - 1)}` : `${name} is first of the cars in this sector`, at <= 0)}${arrow(1, at < group.length - 1 ? `Put ${name} behind ${other(at + 1)}` : `${name} is last of the cars in this sector`, at >= group.length - 1)}</span> <small class="muted">${group.length} cars in this sector with ${eng.lapsOf(c)} laps</small>`;
    const controls = `<label>Last seen in <select data-rvs="${i}" aria-label="Sector where ${name} was last seen"><option value="">not set: the car that crossed the line first</option>${options}</select></label>${arrows}`;
    return cols
      ? `<tr class="rv-sub rv-sector"><td></td><td colspan="${cols - 1}">${controls}</td></tr>`
      : `<div class="rfinish-sector">${controls}</div>`;
  }

  // o.champ: { on, list } when the race gives championship points (a heat race decided on points): they can be adjusted, and the points of the place are shown
  function html(eng, o = {}) {
    const st = eng.standings(),
      on = eng.penalty && eng.penalty.on,
      canAdjust = eng.type === 'race' || eng.type === 'timed',
      champ = canAdjust && !!o.champ && !!o.champ.on,
      cols = 6 + (champ ? 1 : 0);
    const cup = Icons.trophy({ size: 16 }),
      wins = x => Stats.isWinner({ sessionType: eng.type }, { pos: x.pos, dq: x.car.dq, retired: x.car.retired, laps: eng.lapsOf(x.car) }); // (the winner of the race or heat: practice and qualifying have none)
    const rows = st
      .map(x => {
        const c = x.car,
          i = x.index,
          pen = eng.penMs(c),
          name = esc(c.driverName);
        const adjText = Stats.adjustedText({ adjMs: c.adjMs, adjLaps: c.adjLaps, adjPoints: c.adjPoints }),
          adjMs = c.adjMs || 0,
          bopNote = eng.bopNoteOf ? eng.bopNoteOf(i) : '',
          damageNote = eng.damageNoteOf ? eng.damageNoteOf(i) : '',
          failureNote = eng.failureNoteOf ? eng.failureNoteOf(i) : '',
          tyreNote = eng.tyreNoteOf ? eng.tyreNoteOf(i) : ''; // (what Balance of Power and the tyres did to the car)
        const timeCell = c.dq
          ? '<strong>DQ</strong>'
          : `<strong>${fmt(eng.timeOf ? eng.timeOf(c) : c.total + pen + adjMs)}</strong>${pen ? `<br><small class="muted">includes +${fmt(pen)}</small>` : ''}`;
        const pending = c.pending
          .map(
            (p, k) => `<tr class="rv-sub"><td></td><td colspan="${cols - 1}">⚠ <strong>${esc(p.name)}</strong> was not served.
          Add <input type="number" min="0" step="any" class="rv-sec" data-rvt="${i}:${k}" value="${p.unserved}" aria-label="Seconds to add for ${esc(p.name)}"> s
          <button class="btn" data-rv="addtime" data-car="${i}" data-k="${k}">Add time</button>
          ${c.dq ? '' : `<button class="btn danger" data-rv="dq" data-car="${i}" data-k="${k}">Disqualify</button>`}
          <button class="btn" data-rv="forgive" data-car="${i}" data-k="${k}">Forgive</button></td></tr>`
          )
          .join('');
        const secRow = sectorRowHtml(eng, c, i, cols);
        const open = ui.open.has(i);
        const laps = !open
          ? ''
          : `<tr class="rv-sub"><td></td><td colspan="${cols - 1}">${lapListHtml(c, i, false, null, !!eng.safetyCar)}</td></tr>`;
        const adjOpen = canAdjust && ui.adjust.has(i),
          adjRow = !adjOpen
            ? ''
            : `<tr class="rv-sub"><td></td><td colspan="${cols - 1}">${adjustHtml(c, i, { champ, settings: o.settings })}</td></tr>`;
        const lapsCell = `${eng.lapsOf(c)}${c.adjLaps ? `<br><small class="muted">${c.laps.length} driven</small>` : ''}`;
        const pointsCell = !champ
          ? ''
          : `<td class="num rv-champ">${((o.champ.list || [])[x.pos - 1] || 0) + (c.adjPoints || 0) + (eng.pluginPointsOf?.(c, x.pos) || 0)}</td>`;
        return `<tr><td>${x.pos}</td><td>${wins(x) ? cup + ' ' : ''}${name}${c.dq ? ' <span class="muted">(disqualified)</span>' : c.retired ? ` <span class="muted">(${c.dmgOut ? 'out by damage' : c.failOut ? 'out by a failure' : 'out'})</span>` : ''}${adjText ? `<br><small class="muted">adjusted: ${esc(adjText)}</small>` : ''}${bopNote ? `<br><small class="muted">Balance of Power: ${esc(bopNote)}</small>` : ''}${tyreNote ? `<br><small class="muted">Tyres: ${esc(tyreNote)}</small>` : ''}${damageNote ? `<br><small class="muted">Damage: ${esc(damageNote)}</small>` : ''}${failureNote ? `<br><small class="muted">Failures: ${esc(failureNote)}</small>` : ''}</td><td class="num">${lapsCell}</td>
        <td class="num">${timeCell}</td>${pointsCell}<td>${on ? `${c.points} pts${pen ? ` · ${secs(pen)}` : ''}${c.pending.length ? ` · ${c.pending.length} not served` : ''}` : ''}</td>
        <td class="actions">${on && c.points ? `<button class="btn" data-rv="nullify" data-car="${i}">Clear points</button> ` : ''}${on && c.undoPoints ? `<button class="btn" data-rv="restorepoints" data-car="${i}">Restore (${c.undoPoints} pts)</button> ` : ''}${c.dq ? `<button class="btn" data-rv="undq" data-car="${i}">Reinstate</button>` : `<button class="btn" data-rv="dq" data-car="${i}">Disqualify</button>`}
        ${canAdjust ? `<button class="btn" data-rv="adjopen" data-car="${i}" aria-expanded="${adjOpen}" title="Add or take off race time, laps${champ ? ' or championship points' : ''}">${adjOpen ? 'Hide adjust' : 'Adjust'}</button> ` : ''}<button class="btn" data-rv="laps" data-car="${i}" aria-expanded="${open}">${open ? 'Hide laps' : 'Laps'}</button></td></tr>${secRow}${pending}${adjRow}${laps}`;
      })
      .join('');
    const secNote =
      eng.sectors && eng.cars.some(secLive)
        ? `<p class="muted rv-secnote">Sectors: for every car that did not finish, choose the sector of the track where it was last seen. Of two cars with the same laps the one in the later sector ranks higher, and with the same sector you can put one ahead with the arrows. A car with no sector ranks behind the others with the same laps, in the order they crossed the line.</p>`
        : '';
    return `<h3>Race review</h3><p class="muted">The race is over. Check the result and fix it if needed, then press Finalize to save it. Nothing is saved before that.</p>${secNote}
      <div class="wrap"><table class="fields rv-table"><thead><tr><th>Pos</th><th>Driver</th><th>Laps</th><th>Time</th>${champ ? '<th class="rv-champ">Points</th>' : ''}<th>${on ? 'Penalties' : ''}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="row"><button class="btn primary" data-rv="finalize">Finalize results</button> <button class="btn danger" data-rv="discard" title="Nothing from this race is saved in the database">Delete all data</button></div>`;
  }

  // The main computer gets a proper finishing desk (2.4.0, SlotForgeRestyle.md "Scrutineering"): the classification as slim rows, each with a tiny chart of
  // its laps (a strange lap shows at a glance), and a lap explorer for the driver that is picked: a chart of every lap (a click goes to it), the figures,
  // filters (marked, suspect, flags, pit), the stints, and several laps marked at once. It uses the very same commands as html(): only the presentation differs.
  const median = list => {
    const a = list.filter(Number.isFinite).sort((x, y) => x - y);
    if (!a.length) return null;
    const m = a.length >> 1;
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  };
  const sign = ms => (ms > 0 ? '+' : ms < 0 ? '−' : '±') + (Math.abs(ms) / 1000).toFixed(3);
  // what a lap is: its kind (for the colour) and its tags (for the words). med: the median of the clean laps of the car
  function lapFacts(c, n, med, sc) {
    const t = c.laps[n],
      inv = c.invalid.includes(n),
      rem = c.removed.includes(n),
      red = (c.redLaps || []).includes(n),
      resumed = (c.resumedLaps || []).includes(n),
      pit = (c.pitLaps || []).includes(n),
      slow = !!(c.bad || [])[n],
      yellow = (c.yellowFast || []).includes(n);
    // suspect: a lap that no pit stop, flag or pause explains, far from the usual lap (a crossing counted twice, or one missed)
    const short = !!med && !red && !resumed && t < med * 0.6,
      long = !!med && !red && !resumed && !pit && t > med * 1.75;
    const tags = [];
    if (red) tags.push(['red', 'Red flag']);
    if (resumed) tags.push(['flag', 'After a pause']);
    if (pit) tags.push(['pit', 'Pit']);
    if (slow) tags.push(['flag', 'Too slow']);
    if (yellow) tags.push(['flag', sc ? 'Faster than the Safety Car' : 'Faster than the yellow target']);
    if (short) tags.push(['sus', 'Very short: counted twice?']);
    if (long) tags.push(['sus', `About ${Math.round(t / med)} laps: a crossing missed?`]);
    if (inv) tags.push(['bad', 'Invalid']);
    if (rem) tags.push(['bad', 'Not in the records']);
    const kind = rem ? 'out' : inv || red ? 'bad' : short || long ? 'sus' : pit ? 'pit' : slow || yellow || resumed ? 'flag' : 'ok';
    return { t, inv, rem, red, pit, short, long, tags, kind, flagged: kind !== 'ok' };
  }
  const cleanMedian = c =>
    median(c.laps.filter((t, k) => !c.invalid.includes(k) && !c.removed.includes(k) && !(c.redLaps || []).includes(k)));
  // one bar per lap, its height the lap time: the tiny chart of a row of the classification, and the big one of the explorer
  function lapChart(c, o) {
    const n = c.laps.length;
    if (!n) return '';
    const med = o.med,
      facts = c.laps.map((_, k) => lapFacts(c, k, med, o.sc)),
      // (the scale is that of the clean laps: a lap counted twice, a pit stop or a missed crossing does not flatten the others, it runs into the top)
      clean = c.laps.filter((t, k) => facts[k].kind === 'ok' || facts[k].kind === 'flag'),
      base = clean.length ? clean : c.laps,
      sorted = [...base].sort((x, y) => x - y),
      q = f => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(f * (sorted.length - 1))))],
      lo = Math.max(0, q(0.02) * 0.97),
      hi = Math.max(lo + 1, q(0.98) * 1.04, (med || 0) * 1.12);
    const H = o.h || 40,
      gap = n <= 60 ? 0.22 : n <= 160 ? 0.12 : 0;
    const bars = c.laps
      .map((t, k) => {
        const f = facts[k],
          h = Math.max(1.5, ((Math.min(t, hi) - lo) / (hi - lo)) * (H - 2)),
          best = c.best === t && f.kind === 'ok' ? ' rx-best' : '',
          on = o.focus === k ? ' rx-on' : '';
        const col = ['sus', 'bad', 'out'].includes(f.kind)
          ? `<rect class="rx-col rx-col-${f.kind}" x="${k}" y="0" width="1" height="${H}"/>`
          : ''; // (a lap to look at: a faint column behind its bar, also when the bar is tiny)
        return `${col}<rect class="rx-k-${f.kind}${best}${on}${t > hi ? ' rx-cut' : ''}" x="${k + gap / 2}" y="${(H - h).toFixed(2)}" width="${1 - gap}" height="${h.toFixed(2)}"${o.click ? ` data-rv="rxjump" data-car="${o.car}" data-lap="${k}"` : ''}><title>Lap ${k + 1}: ${fmt(t)}${f.tags.length ? ' · ' + f.tags.map(x => x[1]).join(', ') : ''}</title></rect>`;
      })
      .join('');
    const y = v => (H - ((v - lo) / (hi - lo)) * (H - 2)).toFixed(2),
      ml = med && med > lo && med < hi ? `<line class="rx-med" x1="0" x2="${n}" y1="${y(med)}" y2="${y(med)}"/>` : '';
    return `<svg class="${o.cls}" viewBox="0 0 ${n} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(o.label || 'Lap times')}">${bars}${ml}</svg>`;
  }
  function explorerHtml(eng, i, o) {
    const c = eng.cars[i];
    if (!c) return '';
    const n = c.laps.length,
      med = cleanMedian(c),
      sc = !!eng.safetyCar,
      facts = c.laps.map((_, k) => lapFacts(c, k, med, sc));
    const clean = c.laps.filter((t, k) => facts[k].kind === 'ok' || facts[k].kind === 'flag'),
      avg = clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : null,
      sd = clean.length > 1 ? Math.sqrt(clean.reduce((a, b) => a + (b - avg) ** 2, 0) / (clean.length - 1)) : null,
      hasBest = c.best !== null && c.best !== undefined,
      bestAt = hasBest ? c.laps.findIndex((t, k) => t === c.best && !facts[k].inv && !facts[k].rem) : -1,
      bestSus = bestAt >= 0 && (facts[bestAt].short || facts[bestAt].long),
      // (the best lap counted as such is a lap counted twice: the gaps are measured from the best lap that is not suspect)
      ref = (() => {
        const ok = c.laps.filter((t, k) => facts[k].kind === 'ok' || facts[k].kind === 'flag');
        return ok.length ? Math.min(...ok) : hasBest ? c.best : null;
      })();
    const is = {
      all: () => true,
      marked: f => f.inv || f.rem,
      sus: f => f.short || f.long,
      flags: f => f.flagged,
      pit: f => f.pit
    };
    const counts = Object.fromEntries(Object.entries(is).map(([k, fn]) => [k, facts.filter(fn).length]));
    const filter = is[ui.filter] ? ui.filter : 'all',
      shown = facts.map((f, k) => k).filter(k => is[filter](facts[k]));
    const picked = [...ui.checked].filter(k => k >= 0 && k < n);
    const seg = [
      ['all', 'All'],
      ['marked', 'Marked'],
      ['sus', 'Suspect'],
      ['flags', 'Flags'],
      ['pit', 'Pit']
    ]
      .filter(([k]) => k === 'all' || counts[k] || filter === k)
      .map(
        ([k, label]) =>
          `<button type="button" class="btn${filter === k ? ' on' : ''}" data-rv="rxfilter" data-f="${k}" aria-pressed="${filter === k}">${label} <em>${counts[k]}</em></button>`
      )
      .join('');
    // the drivers in the order of the classification, to go from one to the next
    const st = eng.standings(),
      at = Math.max(
        0,
        st.findIndex(x => x.index === i)
      ),
      color = o.color || (() => 'var(--muted)');
    const who = st
      .map(
        x =>
          `<button type="button" class="btn${x.index === i ? ' on' : ''}" data-rv="laps" data-excl="1" data-car="${x.index}" aria-pressed="${x.index === i}" style="--c:${esc(color(x.car.lane))}"><i></i>${esc(x.car.driverName)}</button>`
      )
      .join('');
    const stints = c.en && Array.isArray(c.en.stints) && c.en.stints.length > 1 ? c.en.stints : null,
      nameOf = d => ((c.roster || []).find(r => r.id === d) || {}).name || '';
    const rows = shown
      .map(k => {
        const f = facts[k],
          dBest = ref === null ? null : f.t - ref,
          span = med && ref !== null ? Math.max(0, Math.min(1, (f.t - ref) / Math.max(1, med * 0.4))) : 0;
        const sAt = stints ? stints.findIndex(x => x.l0 === k) : -1,
          head =
            sAt >= 0 && filter === 'all'
              ? `<tr class="rx-stint"><td colspan="7">Stint ${sAt + 1}${nameOf(stints[sAt].d) ? ` · ${esc(nameOf(stints[sAt].d))}` : ''} · from lap ${k + 1}</td></tr>`
              : '';
        const acts =
          ui.del === `${i}:${k}`
            ? `<span class="rv-del">Remove lap ${k + 1}: <button class="btn sm" data-rv="removelap" data-car="${i}" data-lap="${k}" data-recalc="0">From the records only</button> <button class="btn sm danger" data-rv="removelap" data-car="${i}" data-lap="${k}" data-recalc="1">From the race too (recalculate)</button> <button class="btn sm" data-rv="delcancel">Cancel</button></span>`
            : `${f.red ? '' : `<button class="btn sm" data-rv="invalid" data-car="${i}" data-lap="${k}" data-on="${f.inv ? 0 : 1}">${f.inv ? 'Mark valid' : 'Mark invalid'}</button>`}${f.rem ? `<button class="btn sm" data-rv="restorelap" data-car="${i}" data-lap="${k}">Back in the records</button>` : `<button class="btn sm" data-rv="deltry" data-car="${i}" data-lap="${k}">Delete…</button>`}`;
        const pace = paceTag(c, k);
        return `${head}<tr class="rx-row rx-k-${f.kind}${k === bestAt && !bestSus ? ' rx-best' : ''}${ui.checked.has(k) ? ' rx-picked' : ''}${ui.focus === k ? ' rx-on' : ''}" data-rx-lap="${k}">
          <td class="rx-ck"><input type="checkbox" data-rv="rxpick" data-car="${i}" data-lap="${k}" aria-label="Pick lap ${k + 1}"${ui.checked.has(k) ? ' checked' : ''}></td>
          <td class="rx-n">${k + 1}</td><td class="rx-t">${fmt(f.t)}</td>
          <td class="rx-d">${k === bestAt && !bestSus ? '<b>best</b>' : dBest === null ? '' : sign(dBest)}</td>
          <td class="rx-bar"><i style="width:${Math.round(span * 100)}%"></i></td>
          <td class="rx-tags"><div>${f.tags.map(([k2, w]) => `<span class="rx-tag rx-tag-${k2}">${esc(w)}</span>`).join('')}${pace ? `<span class="rx-pace">${esc(pace)}</span>` : ''}</div></td>
          <td class="rx-acts">${acts}</td></tr>`;
      })
      .join('');
    const stat = (label, v, sub) => `<div><span>${label}</span><b>${v}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
    const prev = st[(at - 1 + st.length) % st.length].index,
      next = st[(at + 1) % st.length].index;
    return `<section class="rx" data-rx="${i}" aria-label="Laps of ${esc(c.driverName)}">
      <header class="rx-head"><div class="rx-who seg" role="group" aria-label="Driver">${who}</div>
        <span class="rx-nav">${st.length > 1 ? `<button type="button" class="btn icon sm" data-rv="laps" data-excl="1" data-car="${prev}" aria-label="The driver before" title="The driver before">‹</button><button type="button" class="btn icon sm" data-rv="laps" data-excl="1" data-car="${next}" aria-label="The next driver" title="The next driver">›</button>` : ''}<button type="button" class="btn sm ghost" data-rv="laps" data-excl="1" data-car="${i}" aria-expanded="true">Close</button></span></header>
      <div class="rx-stats">${stat('Laps', n)}${stat('Best', hasBest ? fmt(c.best) : '–', bestAt >= 0 ? `lap ${bestAt + 1}${bestSus ? ' · <em class="rx-warn">suspect: it goes in the records</em>' : ''}` : '')}${stat('Median', med ? fmt(Math.round(med)) : '–')}${stat('Average', avg ? fmt(Math.round(avg)) : '–', 'clean laps')}${stat('Consistency', sd ? '±' + (sd / 1000).toFixed(3) : '–', 'spread of clean laps')}${stat('Marked', counts.marked, counts.sus ? `${counts.sus} suspect` : '')}</div>
      <div class="rx-chartbox">${lapChart(c, { cls: 'rx-chart', h: 100, med, sc, click: true, car: i, focus: ui.focus, label: `Lap times of ${c.driverName}: a bar for every lap` })}
        <p class="rx-legend"><span class="rx-k-ok">Clean</span><span class="rx-best">Best</span><span class="rx-k-pit">Pit</span><span class="rx-k-flag">Flag</span><span class="rx-k-sus">Suspect</span><span class="rx-k-bad">Invalid</span><span class="rx-k-out">Not in the records</span><span class="rx-medl">Median</span><span class="rx-tip">A bar shows its lap in the list.</span></p></div>
      <div class="rx-tools"><span class="seg" role="group" aria-label="Show">${seg}</span>
        <span class="rx-bulk${picked.length ? ' on' : ''}">${picked.length ? `<b>${picked.length} picked</b><button type="button" class="btn sm" data-rv="rxbulk" data-car="${i}" data-do="invalid">Mark invalid</button><button type="button" class="btn sm" data-rv="rxbulk" data-car="${i}" data-do="valid">Mark valid</button><button type="button" class="btn sm" data-rv="rxbulk" data-car="${i}" data-do="records">Take out of the records</button><button type="button" class="btn sm ghost" data-rv="rxpicknone">Clear</button>` : `<button type="button" class="btn sm ghost" data-rv="rxpickall" data-car="${i}" data-laps="${shown.join(',')}"${shown.length ? '' : ' disabled'}>Pick the ${shown.length} shown</button>`}</span></div>
      <div class="rx-scroll" data-rx-scroll="${i}"><table class="rx-table"><thead><tr><th class="rx-ck"></th><th>Lap</th><th>Time</th><th>To best</th><th></th><th>What happened</th><th></th></tr></thead><tbody>${rows || `<tr><td colspan="7" class="muted">No laps${filter === 'all' ? '' : ' of this kind'}</td></tr>`}</tbody></table></div>
    </section>`;
  }
  function finishHtml(eng, o = {}) {
    const st = eng.standings(),
      on = eng.penalty && eng.penalty.on,
      canAdjust = eng.type === 'race' || eng.type === 'timed',
      champ = canAdjust && !!o.champ && !!o.champ.on,
      color = o.color || (() => 'var(--muted)');
    const wins = x =>
      Stats.isWinner({ sessionType: eng.type }, { pos: x.pos, dq: x.car.dq, retired: x.car.retired, laps: eng.lapsOf(x.car) });
    const lead = st[0] && st[0].car,
      timeOf = c => (eng.timeOf ? eng.timeOf(c) : c.total + eng.penMs(c) + (c.adjMs || 0)),
      leadLaps = lead ? eng.lapsOf(lead) : 0;
    const pick = [...ui.open].filter(k => eng.cars[k]).pop(); // (the driver whose laps are open: one at a time on this desk)
    const row = x => {
      const c = x.car,
        i = x.index,
        adjOpen = canAdjust && ui.adjust.has(i),
        total = timeOf(c),
        open = pick === i,
        med = cleanMedian(c);
      const redCount = (c.redLaps || []).filter(n => !c.removed.includes(n)).length,
        marked = new Set([...c.invalid, ...c.removed]).size,
        sus = c.laps.filter((t, k) => {
          const f = lapFacts(c, k, med, !!eng.safetyCar);
          return f.short || f.long;
        }).length;
      const state = c.dq ? 'Disqualified' : c.retired ? 'Out' : wins(x) ? 'Winner' : `Position ${x.pos}`;
      const behind = leadLaps - eng.lapsOf(c),
        gap =
          x.pos === 1 || c.dq || !lead
            ? ''
            : behind > 0
              ? `+${behind} ${behind === 1 ? 'lap' : 'laps'}`
              : '+' + fmt(Math.max(0, total - timeOf(lead)));
      const pending = c.pending
        .map(
          (p, k) =>
            `<div class="rfinish-pending">⚠ <strong>${esc(p.name)}</strong> was not served. Add <input type="number" min="0" step="any" class="rv-sec" data-rvt="${i}:${k}" value="${p.unserved}" aria-label="Seconds to add for ${esc(p.name)}"> s <button class="btn sm" data-rv="addtime" data-car="${i}" data-k="${k}">Add time</button>${c.dq ? '' : ` <button class="btn sm danger" data-rv="dq" data-car="${i}" data-k="${k}">Disqualify</button>`} <button class="btn sm" data-rv="forgive" data-car="${i}" data-k="${k}">Forgive</button></div>`
        )
        .join('');
      const adjusted = Stats.adjustedText({ adjMs: c.adjMs, adjLaps: c.adjLaps, adjPoints: c.adjPoints });
      const chips = [
        adjusted ? `<span class="rf-chip">adjusted: ${esc(adjusted)}</span>` : '',
        marked ? `<span class="rf-chip bad">${marked} marked</span>` : '',
        sus ? `<span class="rf-chip sus">${sus} suspect</span>` : '',
        c.pending.length ? `<span class="rf-chip warn">${c.pending.length} not served</span>` : ''
      ].join('');
      const notes = `${redCount ? `<p class="rfinish-alert"><strong>Red-flag interruption</strong> · ${redCount} ${redCount === 1 ? 'lap is' : 'laps are'} invalid and excluded from records.</p>` : ''}${eng.cfg?.rulePlugin ? `<p class="rfinish-alert"><strong>${esc(eng.cfg.rulePlugin.name)}</strong> · rule time +${fmt(eng.pluginTimeOf(c))} · competition bonus ${eng.pluginPointsOf(c, x.pos)} pts. Invalidated laps lose their rule-time consequence; fuel and tyre use remain historical.</p>` : ''}${sectorRowHtml(eng, c, i, 0)}${pending}`;
      const num = (label, v, sub) => `<div class="rf-num"><span>${label}</span><b>${v}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
      return `<article class="rfinish-card${wins(x) ? ' winner' : ''}${c.dq ? ' dq' : ''}${open ? ' picked' : ''}" role="listitem" style="--c:${esc(color(c.lane))}">
        <div class="rf-row">
          <span class="rfinish-place">${c.dq ? 'DQ' : x.pos}</span>
          <div class="rf-who"><strong>${wins(x) ? Icons.trophy({ size: 16 }) + ' ' : ''}${esc(c.driverName)}</strong><span class="muted">Lane ${c.lane + 1}${c.carName ? ` · ${esc(c.carName)}` : ''} · <b class="rfinish-state">${esc(state)}</b></span>${chips ? `<span class="rf-chips">${chips}</span>` : ''}</div>
          <button type="button" class="rf-spark" data-rv="laps" data-excl="1" data-car="${i}" title="The laps of ${esc(c.driverName)}" aria-label="Open the laps of ${esc(c.driverName)}">${lapChart(c, { cls: 'rf-sparkline', h: 32, med, sc: !!eng.safetyCar, label: `Laps of ${c.driverName}` })}</button>
          ${num('Laps', eng.lapsOf(c), c.adjLaps ? `${c.laps.length} driven` : '')}${num('Total', c.dq ? 'DQ' : fmt(total), gap)}${num('Best lap', c.best === null || c.best === undefined ? '–' : fmt(c.best))}${champ ? num('Points', ((o.champ.list || [])[x.pos - 1] || 0) + (c.adjPoints || 0) + (eng.pluginPointsOf?.(c, x.pos) || 0)) : ''}${on ? num('Penalties', `${c.points || 0} pts`) : ''}
          <div class="rfinish-actions"><button class="btn sm${open ? ' on' : ''}" data-rv="laps" data-excl="1" data-car="${i}" aria-expanded="${open}">${open ? 'Hide laps' : 'Review laps'}${redCount ? ` (${redCount} red-flag ${redCount === 1 ? 'lap' : 'laps'})` : ''}</button>${canAdjust ? `<button class="btn sm" data-rv="adjopen" data-car="${i}" aria-expanded="${adjOpen}">${adjOpen ? 'Hide adjustments' : 'Adjust result'}</button>` : ''}${on && c.points ? `<button class="btn sm" data-rv="nullify" data-car="${i}">Clear points</button>` : ''}${on && c.undoPoints ? `<button class="btn sm" data-rv="restorepoints" data-car="${i}">Restore points</button>` : ''}${c.dq ? `<button class="btn sm" data-rv="undq" data-car="${i}">Reinstate driver</button>` : `<button class="btn sm danger" data-rv="dq" data-car="${i}">Disqualify driver</button>`}</div>
        </div>
        ${notes ? `<div class="rf-notes">${notes}</div>` : ''}${adjOpen ? `<div class="rfinish-detail">${adjustHtml(c, i, { champ, settings: o.settings })}</div>` : ''}
      </article>`;
    };
    const pending = st.reduce((n, x) => n + x.car.pending.length, 0),
      invalid = eng.cars.reduce((n, c) => n + new Set([...c.invalid, ...c.removed]).size, 0);
    const explorer =
      pick === undefined
        ? '<p class="rx-hint">Pick a driver, or the little chart of their laps, to go through every lap: a chart of all laps, filters for marked and suspect laps, and several laps marked at once.</p>'
        : explorerHtml(eng, pick, { color });
    return `<section class="rfinish"><header class="rfinish-head"><div><p class="eyebrow">DIRECTOR'S FINAL CHECK</p><h2>Finalize race results</h2><p class="muted">Review the classification, laps and penalties. Nothing is saved until you finalize.</p></div><div class="rfinish-headactions"><span class="rfinish-check">${invalid ? `${invalid} lap${invalid === 1 ? '' : 's'} marked` : 'All laps checked'}${pending ? ` · ${pending} penalty${pending === 1 ? '' : 'ies'} waiting` : ''}</span><button class="btn primary" data-rv="finalize">Finalize results</button><button class="btn danger" data-rv="discard">Delete all data</button></div></header>
      <div class="rfinish-grid rf-list" role="list" aria-label="Classification">${st.map(row).join('')}</div>${explorer}<footer class="rfinish-foot"><button class="btn primary" data-rv="finalize">Finalize results</button><button class="btn danger" data-rv="discard">Delete all data</button></footer></section>`;
  }
  // The review page is drawn again after every change: the lap list keeps where it was scrolled to, and a lap picked in the chart comes into view.
  function render(root, h) {
    const keep = {};
    if (root.querySelectorAll) root.querySelectorAll('[data-rx-scroll]').forEach(el => (keep[el.dataset.rxScroll] = el.scrollTop));
    root.innerHTML = h;
    if (!root.querySelectorAll) return;
    root.querySelectorAll('[data-rx-scroll]').forEach(el => {
      if (keep[el.dataset.rxScroll] !== undefined) el.scrollTop = keep[el.dataset.rxScroll];
    });
    if (ui.focus !== null && ui.focus !== undefined) {
      const r = root.querySelector(`[data-rx-lap="${ui.focus}"]`),
        box = r && r.closest('[data-rx-scroll]');
      if (r && box) box.scrollTop = r.offsetTop - box.clientHeight / 2;
    }
  }

  // During the race (any session type): the laps of every car, to mark a lap invalid or take it out. The review after the race stays as it is.
  // o.late(car, lap): see lapListHtml. Corrections go to the race as the same operations as in the review after the race.
  function lapsHtml(eng, o = {}) {
    const cars = eng.cars.map((c, i) => ({ c, i })).sort((a, b) => a.c.lane - b.c.lane);
    const blocks = cars
      .map(({ c, i }) => {
        const open = ui.open.has(i),
          last = c.laps.length ? fmt(c.laps[c.laps.length - 1]) : '–',
          best = c.best === null || c.best === undefined ? '–' : fmt(c.best);
        return `<div class="rv-car"><div class="rv-head"><strong>Lane ${c.lane + 1}</strong> <span>${esc(c.driverName)}${c.dq ? ' <span class="muted">(disqualified)</span>' : ''}</span>
          <span class="muted rv-sum">${c.laps.length} ${c.laps.length === 1 ? 'lap' : 'laps'} · last ${last} · best ${best}</span>
          <button class="btn" data-rv="laps" data-car="${i}" aria-expanded="${open}">${open ? 'Hide laps' : 'Laps'}</button></div>
        ${open ? lapListHtml(c, i, true, o.late ? n => o.late(i, n) : null, !!eng.safetyCar) : ''}</div>`;
      })
      .join('');
    return `<h3>Review laps</h3><p class="muted">Mark a lap invalid, or take it out of the records, while the race goes on. The newest lap is on top. The review after the race stays.</p>
      <div class="rv-cars">${blocks}</div>`;
  }

  // the time bought, as words: 5 min, 2 min 30 s
  const boughtText = ms => {
    const sec = Math.round(Number(ms) / 1000);
    if (!Number.isFinite(sec)) return '';
    const m = Math.floor(sec / 60),
      r = sec % 60;
    return !r ? `${m} min` : m ? `${m} min ${r} s` : `${r} s`;
  };
  const STINT_END = { expired: 'Time ran out', cleared: 'Lane switched off', driver: 'Driver changed', session: 'Session ended' };
  const stintLapsHtml = s =>
    `<div class="rv-laps">${
      s.laps
        .map((l, n) => {
          const inv = !!l.late || !!l.invalid,
            rem = !!l.removed;
          const tags = [
            l.bad ? 'too slow' : '',
            l.late ? 'after the time ran out' : l.invalid ? 'invalid' : '',
            rem ? 'not in the records' : ''
          ].filter(Boolean);
          const del =
            ui.del === `s${s.id}:${n}`
              ? `<span class="rv-del">Remove lap ${n + 1}:
          <button class="btn" data-rv="tkremove" data-sid="${s.id}" data-lap="${n}" data-recalc="0">From the records only</button>
          <button class="btn danger" data-rv="tkremove" data-sid="${s.id}" data-lap="${n}" data-recalc="1">From the stint too</button>
          <button class="btn" data-rv="delcancel">Cancel</button></span>`
              : `<button class="btn" data-rv="deltry" data-sid="${s.id}" data-lap="${n}">Delete…</button>`;
          return `<div class="rv-lap${inv || rem ? ' rv-bad' : ''}"><span class="num">${n + 1}</span> <span class="rv-t">${fmt(l.t)}</span> ${tags.map(g => `<small class="muted">${g}</small>`).join(' ')}
        ${l.late ? '' : `<button class="btn" data-rv="tkinvalid" data-sid="${s.id}" data-lap="${n}" data-on="${inv ? 0 : 1}">${inv ? 'Mark valid' : 'Mark invalid'}</button>`} ${del}</div>`;
        })
        .join('') || '<span class="muted">No laps</span>'
    }</div>`;

  // The review at the end of a Time Token Session: every stint (one driver's run on one lane) with its laps. Nothing is saved before Finalize.
  function stintsHtml(list, o = {}) {
    const rows = list
      .map(s => {
        const who = s.who || {},
          counted = s.laps.filter(l => !l.late),
          lateN = s.laps.length - counted.length,
          open = ui.openStints.has(s.id);
        return `<tr><td>${s.lane + 1}</td><td>${esc(who.driverName || 'Guest')}${who.carName ? `<br><small class="muted">${esc(who.carName)}</small>` : ''}</td><td class="num">${boughtText(s.bought)}</td>
        <td class="num">${counted.length}${lateN ? `<br><small class="muted">+${lateN} after the time</small>` : ''}</td><td class="num">${s.best === null || s.best === undefined ? '–' : fmt(s.best)}</td><td>${esc(STINT_END[s.closedBy] || '')}</td>
        <td class="actions"><button class="btn" data-rv="laps" data-sid="${s.id}" aria-expanded="${open}">${open ? 'Hide laps' : 'Laps'}</button></td></tr>
        ${open ? `<tr class="rv-sub"><td></td><td colspan="6">${stintLapsHtml(s)}</td></tr>` : ''}`;
      })
      .join('');
    return `<h3>Session review</h3><p class="muted">The session is over. Check the stints and fix the laps if needed, then press Finalize to save them as Token Records. Nothing is saved before that.</p>
      <div class="wrap"><table class="fields rv-table"><thead><tr><th>Lane</th><th>Driver</th><th>Time bought</th><th>Laps</th><th>Best lap</th><th>Ended</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      ${o.failed ? `<p class="muted" role="alert">${esc(o.failed)}</p>` : ''}
      <div class="row"><button class="btn primary" data-rv="finalize">Finalize results</button> <button class="btn danger" data-rv="discard" data-what="session" title="Nothing from this session is saved in the database">Delete all data</button></div>`;
  }

  // Clicks on a review panel. Corrections go to send({op, ...}); unfolding things is only on screen, so redraw() does that.
  function bind(root, send, redraw) {
    root.onchange = ev => {
      // (1.66.0) the sector where a car that did not finish was last seen
      const sel = ev.target && ev.target.closest ? ev.target.closest('[data-rvs]') : null;
      if (!sel) return;
      send({ op: 'sector', car: Number(sel.dataset.rvs), sector: sel.value === '' ? null : Number(sel.value) });
    };
    root.onclick = async ev => {
      const b = ev.target && ev.target.closest ? ev.target.closest('[data-rv]') : null;
      if (!b || b.disabled) return;
      const d = b.dataset,
        op = d.rv,
        car = d.car === undefined ? undefined : Number(d.car),
        sid = d.sid === undefined ? undefined : Number(d.sid);
      if (op === 'discard') {
        const session = d.what === 'session';
        if (
          !(await Dialog.confirm(
            session
              ? "Delete all data of this session?\n\nNo stint is recorded in the database: no laps, no results, no Token Records.\n\nThis can't be undone."
              : "Delete all data of this race?\n\nNothing is recorded in the database: no laps, no results, no records. In a heat race this includes the earlier heats.\n\nThis can't be undone.",
            { ok: 'Delete all data', cancel: 'Keep reviewing', danger: true }
          ))
        )
          return;
        // (the review may have ended while the question was open: only delete while it still offers this; the race checks its phase as well)
        if (root.isConnected === false || (root.querySelector && !root.querySelector('[data-rv="discard"]'))) return;
      }
      if (op === 'adjopen') {
        if (ui.adjust.has(car)) ui.adjust.delete(car);
        else ui.adjust.add(car);
        return redraw();
      }
      if (op === 'adjust') {
        // a pad: add or deduct its value (or what is typed in the field of that pad)
        const r = AdjustPad.read(b);
        if (!r) return; // (an empty field, zero, a minus sign or text: nothing to do)
        return send({
          op,
          car,
          ms: r.group === 'time' ? Math.round(r.amount * 1000) : undefined,
          laps: r.group === 'laps' ? r.amount : undefined,
          points: r.group === 'champ' ? r.amount : undefined
        });
      }
      if (op === 'laps') {
        const set = sid === undefined ? ui.open : ui.openStints,
          key = sid === undefined ? car : sid;
        if (d.excl === '1') {
          // (the finishing desk: the laps of one driver at a time; the driver buttons of the explorer always open, the others open and close)
          const was = set.has(key);
          set.clear();
          if (!was || (b.closest && b.closest('.rx-who,.rx-nav'))) set.add(key);
          ui.checked.clear();
          ui.focus = null;
          ui.del = null;
        } else if (set.has(key)) set.delete(key);
        else set.add(key);
        return redraw();
      }
      if (op === 'rxfilter') {
        ui.filter = d.f;
        return redraw();
      }
      if (op === 'rxpick') {
        const k = Number(d.lap);
        if (ui.checked.has(k)) ui.checked.delete(k);
        else ui.checked.add(k);
        return redraw();
      }
      if (op === 'rxpickall') {
        String(d.laps || '')
          .split(',')
          .filter(x => x !== '')
          .forEach(x => ui.checked.add(Number(x)));
        return redraw();
      }
      if (op === 'rxpicknone') {
        ui.checked.clear();
        return redraw();
      }
      if (op === 'rxjump') {
        ui.filter = 'all';
        ui.focus = Number(d.lap);
        return redraw();
      }
      if (op === 'rxbulk') {
        // several laps at once: the same command as for one lap, for every lap that was picked
        const laps = [...ui.checked].sort((x, y) => x - y);
        ui.checked.clear();
        for (const lap of laps)
          if (d.do === 'records') send({ op: 'removelap', car, lap, recalc: false });
          else send({ op: 'invalid', car, lap, on: d.do === 'invalid' });
        return redraw();
      }
      if (op === 'deltry') {
        ui.del = sid === undefined ? `${car}:${d.lap}` : `s${sid}:${d.lap}`;
        return redraw();
      }
      if (op === 'delcancel') {
        ui.del = null;
        return redraw();
      }
      if (op === 'addtime') {
        const inp = root.querySelector(`[data-rvt="${car}:${d.k}"]`),
          s = Number(inp && inp.value);
        send({ op, car, ms: Math.round((Number.isFinite(s) ? s : 0) * 1000) });
        return send({ op: 'forgive', car, k: Number(d.k) }); // the penalty is settled
      }
      if (op === 'removelap' || op === 'tkremove') ui.del = null;
      send({
        op,
        car,
        sid,
        k: d.k === undefined ? undefined : Number(d.k),
        lap: d.lap === undefined ? undefined : Number(d.lap),
        on: d.on === '1',
        recalc: d.recalc === '1',
        ...(d.dir === undefined ? {} : { dir: Number(d.dir) })
      });
    };
  }

  // a new race or session: nothing is unfolded yet
  function reset() {
    ui.open.clear();
    ui.openStints.clear();
    ui.adjust.clear();
    ui.del = null;
    ui.filter = 'all';
    ui.checked.clear();
    ui.focus = null;
  }

  // one correction on the real engine; true when something changed
  function apply(eng, c) {
    switch (c.op) {
      case 'nullify':
        return eng.nullify(c.car);
      case 'restorepoints':
        return eng.restorePoints(c.car);
      case 'forgive':
        return eng.forgive(c.car, c.k);
      case 'addtime':
        return eng.addTime(c.car, c.ms);
      case 'adjust':
        return Number.isInteger(c.car) && eng.adjust(c.car, { ms: c.ms, laps: c.laps, points: c.points });
      case 'adjustreset':
        return Number.isInteger(c.car) && eng.adjustReset(c.car);
      case 'dq':
        return eng.setDq(c.car, true);
      case 'undq':
        return eng.setDq(c.car, false);
      case 'invalid':
        return eng.setInvalid(c.car, c.lap, !!c.on);
      case 'removelap':
        return eng.removeLap(c.car, c.lap, !!c.recalc);
      case 'restorelap':
        return !!eng.restoreLap && eng.restoreLap(c.car, c.lap);
      case 'sector':
        return Number.isInteger(c.car) && eng.setSector(c.car, c.sector);
      case 'sectormove':
        return Number.isInteger(c.car) && eng.moveSector(c.car, c.dir);
    }
    return false;
  }
  return { html, finishHtml, lapsHtml, stintsHtml, bind, apply, reset, render, boughtText, ui, lapFacts, median };
})();
if (typeof module !== 'undefined') module.exports = Review;
