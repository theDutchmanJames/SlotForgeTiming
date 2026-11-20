// After the race (2.4.0, SlotForgeRestyle.md "Chequered Flag"): the screens the race page shows when a race is over, like the graphics of a race
// broadcast. Race over (the winner big, with the lane's helmet, the highlights, the actions; the classification as a timing tower and the race story),
// the same with the title fight of a championship next to it (as big as the race), the break between two heats (the next heat and its line-up,
// the standings with a column per heat) and Event over (the last heat or final is done). Pure: it works out the figures and builds HTML; race.js
// gives it what it knows and wires the buttons (data-ro="...").
(function (root) {
  const E = typeof module !== 'undefined' ? require('./engine.js') : root.RaceEngine;
  const RR = typeof module !== 'undefined' ? require('./racereport.js') : root.RaceReport;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const t = ms => (Number.isFinite(ms) && ms > 0 ? E.fmtTime(ms) : '–');
  const s3 = ms => (Number.isFinite(ms) ? (ms / 1000).toFixed(3) : '–');
  const num = v => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) / 100 : 0);
  const plural = (n, one, more) => `${n} ${n === 1 ? one : more}`;
  const PALETTE = ['#e5484d', '#3b82f6', '#f5c211', '#3ecf8e', '#a855f7', '#f97316', '#14b8a6', '#ec4899'];
  const colorOf = (o, lane) =>
    Number.isInteger(lane) && lane >= 0 ? (o && o.laneColor ? o.laneColor(lane) : PALETTE[lane % PALETTE.length]) : '';
  // the picture of a lane: the driver's own avatar, else the helmet of the lane (renderer/avatars, lanes 1-8)
  const pictureOf = (x, lane) => (x && x.avatar) || (Number.isInteger(lane) && lane >= 0 && lane < 8 ? `avatars/Lane${lane + 1}.png` : '');

  // ---- the figures (pure, tested) ----
  // rows: the standings of the session, each with lane (0-based or null) and avatar from race.js. recordBefore: the track record before this race (ms).
  function figures(session, laps, o = {}) {
    const rows = (session.standings || []).map((x, i, all) => ({
      pos: x.pos,
      name: (x.asTeam && x.teamName) || x.driverName || '',
      car: x.carName || '',
      lane: Number.isInteger(x.lane) ? x.lane : null,
      avatar: x.avatar || '',
      laps: x.laps,
      total: typeof x.total === 'number' ? x.total + (x.penalty || 0) + (x.adjMs || 0) : null,
      best: Number(x.best) > 0 ? Number(x.best) : null,
      points: x.points,
      gap: RR.gapText(session, all, i),
      out: x.dq ? 'Disqualified' : x.retired ? 'Retired' : ''
    }));
    const F = RR.facts(session, laps || []),
      S = RR.story(session, F),
      fastest = F.fastest ? { name: F.fastest.name, time: F.fastest.time, lap: F.fastest.n } : null;
    const before = Number.isFinite(o.recordBefore) && o.recordBefore > 0 ? o.recordBefore : null,
      record =
        fastest && (before === null || fastest.time < before) && o.recordBefore !== undefined
          ? { before, now: fastest.time, by: fastest.name }
          : null;
    const moments = [];
    let changes = 0;
    if (S) {
      const names = F.per.map(p => (p.x.asTeam && p.x.teamName) || p.x.driverName),
        leaderAt = k => S.pos.findIndex(a => a[k] === 1);
      let lead = leaderAt(0),
        lastChange = 0;
      for (let k = 1; k < S.K; k++) {
        const now = leaderAt(k);
        if (now < 0 || now === lead) continue;
        changes++;
        lastChange = k;
        moments.push({
          lap: k + 1,
          who: now,
          text: lead >= 0 ? `${names[now]} passes ${names[lead]} for the lead` : `${names[now]} takes the lead`
        });
        lead = now;
      }
      const end = S.K - lastChange;
      if (changes && end >= 3 && lead >= 0)
        moments.push({ lap: lastChange + 1, who: lead, text: `${names[lead]} leads the last ${end} laps`, kind: 'hold' });
      if (!changes && lead >= 0) moments.push({ lap: 1, who: lead, text: `${names[lead]} leads from start to finish`, kind: 'hold' });
      if (record) {
        const who = names.indexOf(record.by);
        moments.push({
          lap: fastest.lap,
          who,
          text: `${s3(record.now)}: ${record.before ? 'new track record' : 'the first track record'}${o.trackName ? ' on ' + o.trackName : ''}`,
          kind: 'record'
        });
      }
      moments.sort((a, b) => a.lap - b.lap);
      // (a long race: the first lead change, the last ones and the record; at most six)
      while (moments.length > 6) moments.splice(1, 1);
    }
    return { rows, winner: rows[0] || null, fastest, record, changes, moments, story: S, per: F.per, laps: (laps || []).length };
  }

  // ---- the parts ----
  const chip = (label, value, tone) => `<span class="ro-chip${tone ? ' ' + tone : ''}"><small>${esc(label)}</small><b>${value}</b></span>`;
  // the band on top: a chequered strip, the kicker, the headline (the second part grey), what happened, the highlights, the picture with its place, the actions
  function hero({ kicker, big, more, sub, chips, picture, place, bar, saved }) {
    return `<div class="ro-hero"><div class="ro-chq" aria-hidden="true"></div><div class="ro-hin"><div class="ro-words"><div class="ro-k">${kicker}</div><h2 class="ro-big">${esc(big)}${more ? ` <em>${esc(more)}</em>` : ''}</h2>${sub ? `<p class="ro-sub">${sub}</p>` : ''}${chips ? `<div class="ro-chips">${chips}</div>` : ''}</div>${
      picture
        ? `<div class="ro-helm" aria-hidden="true">${place ? `<span class="ro-place p${esc(place)}">${esc(place)}</span>` : ''}<img src="${esc(picture)}" alt=""></div>`
        : ''
    }</div><div class="ro-bar" role="group" aria-label="What next">${bar}${saved ? `<span class="ro-saved" role="status">${saved}</span>` : ''}</div></div>`;
  }
  const btn = (act, label, primary) =>
    `<button type="button" class="btn${primary ? ' primary' : ''}" data-ro="${act}">${esc(label)}</button>`;
  const card = (title, note, body, cls) =>
    `<section class="ro-card${cls ? ' ' + cls : ''}"><div class="ro-ch"><h3>${esc(title)}</h3>${note ? `<small>${note}</small>` : ''}</div>${body}</section>`;
  // the classification as a timing tower: the place in gold, silver or bronze, the lane stripe and helmet, laps, time, the gap, the best lap (purple: the fastest of all)
  function tower(rows, o = {}) {
    const fast = o.fastest ? o.fastest.time : null;
    const head = `<div class="ro-row hd" aria-hidden="true"><span>Pos</span><span></span><span></span><span>Driver</span><span class="r">Laps</span><span class="r">Time</span><span class="r">Gap</span><span class="r">Best</span></div>`;
    return `<div class="ro-tower" role="table" aria-label="Classification">${head}${rows
      .map(x => {
        const c = colorOf(o, x.lane),
          pic = pictureOf(x, x.lane),
          car = o.compact ? x.car.replace(/\s+#\d+$/, '') : x.car + (Number.isInteger(x.lane) ? ` · lane ${x.lane + 1}` : '');
        return `<div class="ro-row" role="row"${c ? ` style="--c:${esc(c)}"` : ''}><span class="ro-pos p${esc(x.pos)}" role="cell">${esc(x.pos)}</span><span class="ro-str" aria-hidden="true"></span>${pic ? `<img class="ro-av" src="${esc(pic)}" alt="">` : '<span></span>'}<span class="ro-nm" role="cell"><b>${esc(x.name)}</b><small>${esc(car)}${x.out ? ' · ' + esc(x.out) : ''}</small></span><span class="r" role="cell">${esc(x.laps ?? '–')}</span><span class="r" role="cell">${esc(t(x.total))}</span><span class="ro-gap${x.gap ? '' : ' lead'}" role="cell">${esc(x.gap || (x.pos === 1 ? 'Winner' : '–'))}</span><span class="ro-best${fast && x.best === fast ? ' fl' : ''}" role="cell">${esc(x.best ? s3(x.best) : '–')}</span></div>`;
      })
      .join('')}</div>`;
  }
  // the race story: the place of every driver after every lap, in lane colours, and the moments under it
  function storyCard(f, o = {}) {
    const S = f.story;
    if (!S) return '';
    const W = 520,
      n = S.n,
      H = Math.max(110, Math.min(220, 40 * n)),
      L = 26,
      T = 12,
      B = 20,
      pw = W - L - 10,
      ph = H - T - B;
    const x = k => L + (S.K === 1 ? 0 : (k * pw) / (S.K - 1)),
      y = p => T + (n === 1 ? 0 : ((p - 1) * ph) / (n - 1));
    const step = S.K > 150 ? 25 : S.K > 60 ? 10 : 5;
    let svg = `<svg class="ro-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="The place of every driver after every lap">`;
    for (let p = 1; p <= n; p++)
      svg += `<line class="ro-gl" x1="${L}" x2="${W - 10}" y1="${y(p)}" y2="${y(p)}"/><text class="ro-yl" x="${L - 8}" y="${y(p) + 4}">${p}</text>`;
    for (let k = 0; k < S.K; k++)
      if (k === 0 || (k + 1) % step === 0) svg += `<text class="ro-xl" x="${x(k).toFixed(1)}" y="${H - 4}">${k + 1}</text>`;
    const colours = f.per.map(
      (p, i) => colorOf(o, Number.isInteger(f.rows[i] && f.rows[i].lane) ? f.rows[i].lane : i) || PALETTE[i % PALETTE.length]
    );
    for (let i = S.pos.length - 1; i >= 0; i--) {
      const pts = S.pos[i].map((r, k) => (r ? `${x(k).toFixed(1)},${y(r).toFixed(1)}` : '')).filter(Boolean);
      if (pts.length)
        svg += `<polyline class="ro-ln${i === 0 ? ' win' : ''}" points="${pts.join(' ')}" style="stroke:${esc(colours[i])}"/>`;
    }
    svg += '</svg>';
    const names = f.per.map(p => (p.x.asTeam && p.x.teamName) || p.x.driverName);
    const legend = `<div class="ro-legend">${names.map((nm, i) => `<span style="--c:${esc(colours[i])}">${esc(nm)}</span>`).join('')}</div>`;
    const moments = f.moments.length
      ? `<ul class="ro-mom">${f.moments.map(m => `<li class="${esc(m.kind || '')}"><span class="lap">Lap ${esc(m.lap)}</span><i style="--c:${esc(colours[m.who] || 'var(--muted)')}"></i><span>${esc(m.text)}</span></li>`).join('')}</ul>`
      : '';
    return card('Race story', 'place on every lap', svg + legend + moments, 'ro-story');
  }
  // the highlights of a race, as chips: the fastest lap (purple), a new track record (gold), lead changes, laps
  function raceChips(f) {
    return (
      (f.fastest ? chip('Fastest lap', `${esc(s3(f.fastest.time))} · ${esc(f.fastest.name)}`, 'fl') : '') +
      (f.record ? chip('Track record', `${esc(s3(f.record.now))} · ${f.record.before ? 'new' : 'first'}`, 'rec') : '') +
      (f.story && f.story.n > 1 && f.changes ? chip('Lead changes', esc(f.changes)) : '') +
      chip('Laps', esc(f.laps))
    );
  }
  // what the winner did, in one line: car, lane, laps and time, the margin
  function winLine(f) {
    const w = f.winner;
    if (!w) return '';
    const second = f.rows[1];
    return [
      w.car && esc(w.car),
      Number.isInteger(w.lane) ? 'lane ' + (w.lane + 1) : '',
      w.laps !== undefined ? `${esc(plural(w.laps, 'lap', 'laps'))} in <b>${esc(t(w.total))}</b>` : '',
      second && second.gap ? `<b>${esc(second.gap.replace(/^\+/, ''))}</b> ahead of ${esc(second.name)}` : ''
    ]
      .filter(Boolean)
      .join(' · ');
  }
  const actionsBar = (o, first) =>
    first +
    (o.again ? btn('again', o.event ? 'Run the event again' : 'Race again') : '') +
    btn('print', 'Print the race report') +
    btn('results', 'Open in Results') +
    (o.announce ? btn('announce', 'Announce the result') : '');

  // the title fight of a championship after this race, as big as the race: the rounds, the first three, the standings with this race's points
  // view: ChampPts.awardView; o.awarded (the points are in the standings), o.next ({ label, track, date, sessions, lanes }) for the band under it
  function champCard(view, o = {}) {
    if (!view || view.state !== 'race' || !view.after) return '';
    const after = view.after.drivers || [],
      gain = new Map((view.rows || []).filter(x => !x.guest).map(x => [x.driverId, x])),
      top = after.length ? after[0].total : 0;
    const cols = view.after.cols || [],
      at = view.round - 1,
      rounds = view.total || cols.length;
    const track = `<ul class="ro-trk ch" aria-label="The rounds">${Array.from({ length: rounds }, (_, i) => `<li class="${i <= at ? 'done' : i === at + 1 ? 'next' : 'later'}"><b>R${i + 1}</b></li>`).join('')}</ul>`;
    const mv = d => {
      const g = gain.get(d.id),
        was = g && g.posBefore,
        diff = was ? was - d.pos : 0;
      return diff > 0
        ? `<span class="ro-mv up">▲ ${diff}</span>`
        : diff < 0
          ? `<span class="ro-mv dn">▼ ${-diff}</span>`
          : '<span class="ro-mv eq">–</span>';
    };
    const plus = d => {
      const g = gain.get(d.id);
      return g && g.change ? `<span class="ro-plus">+${esc(num(g.change))}</span>` : '<span class="ro-plus none">0</span>';
    };
    const gapOf = d => (d.pos === 1 ? 'Leader' : `−${num(top - d.total)}`);
    const pod = after
      .slice(0, 3)
      .map(
        d =>
          `<div class="ro-pc p${esc(d.pos)}"><div class="t"><i>${esc(d.pos)}</i><b>${esc(d.name)}</b></div><div class="v">${esc(num(d.total))} <small>pts</small></div><div class="d">${mv(d)} <span>${esc(gapOf(d))}</span> ${plus(d)}</div></div>`
      )
      .join('');
    // (a big roster: everyone with points (at least three rows); the drivers without a point are one line)
    const shown = after.filter((d, i) => i < 3 || (gain.get(d.id) && gain.get(d.id).change) || Number(d.total) > 0),
      zero = after.length - shown.length;
    const table = `<table class="ro-st"><thead><tr><th>Pos</th><th>Driver</th><th class="c">Move</th><th class="r">This race</th><th class="r">Total</th></tr></thead><tbody>${shown
      .map(
        d =>
          `<tr><td><span class="ro-pos sm p${esc(d.pos)}">${esc(d.pos)}</span></td><td><b>${esc(d.name)}</b> <small class="ro-mut">${esc(d.pos === 1 ? '' : gapOf(d))}</small></td><td class="c">${mv(d)}</td><td class="r">${plus(d)}</td><td class="ro-pts" style="--w:${top > 0 ? Math.round((100 * d.total) / top) : 0}%">${esc(num(d.total))}<i></i></td></tr>`
      )
      .join(
        ''
      )}</tbody></table>${zero ? `<p class="ro-more">${esc(plural(zero, 'more driver', 'more drivers'))} without points yet</p>` : ''}`;
    const award = o.awarded
      ? `<div class="ro-aw" role="status"><span>✓ The points of this race are in the standings</span>${btn('champ-undo', 'Undo')}<button type="button" class="btn ro-quietdanger" data-ro="champ-off">Do not count this race</button></div>`
      : `<div class="ro-aw wait" role="status"><span>These points are not in the standings yet</span>${btn('champ-award', 'Award these points', true)}<button type="button" class="btn ro-quietdanger" data-ro="champ-off">Do not count this race</button></div>`;
    const notes = (view.notes || []).length ? `<div class="ro-notes">${view.notes.map(n => `<p>${n}</p>`).join('')}</div>` : '';
    return card(
      'Title fight',
      `${esc(view.name)} · after ${esc(view.roundLabel || 'round ' + view.round)} of ${esc(rounds)}`,
      track + `<div class="ro-pod">${pod}</div>` + table + award + notes,
      'ro-title'
    );
  }
  function nextRound(next, name) {
    if (!next)
      return `<section class="ro-next done"><div><div class="ro-k">${esc(name)}</div><h3 class="ro-nh">The season is complete</h3><p class="ro-sub">Every round is driven. The final standings are in Database › Results › Championships.</p></div></section>`;
    return `<section class="ro-next"><div><div class="ro-k">Next in ${esc(name)}</div><h3 class="ro-nh">${esc(next.label)}${next.track ? ' · ' + esc(next.track) : ''}</h3><p class="ro-sub">${[next.date, next.lanes ? plural(next.lanes, 'lane', 'lanes') : ''].filter(Boolean).map(esc).join(' · ')}</p>${
      (next.sessions || []).length
        ? `<div class="ro-ses">${next.sessions.map(s => `<span>${esc(s)}</span>`).join('<i aria-hidden="true">→</i>')}</div>`
        : ''
    }</div><p class="ro-sub ro-nhint">${esc(next.goLabel || 'Go to the next round')} opens Home with its first session loaded.</p></section>`;
  }

  // ---- the screens ----
  // Race over (a race, or the event of heats when o.event): o = { session, f (figures), kicker, champ: { view, awarded, next, name }, again, announce, saved, laneColor }
  function overHtml(o) {
    const f = o.f,
      w = f.winner,
      ch = o.champ && o.champ.view && o.champ.view.state === 'race' ? o.champ : null;
    if (!w) return emptyHtml(o);
    const leadsNow = ch && (ch.view.after.drivers || [])[0],
      leads = !!(leadsNow && w && leadsNow.name === w.name && ch.awarded);
    const champChip =
      ch && leadsNow
        ? chip(
            ch.name,
            `P${(ch.view.after.drivers || []).findIndex(d => d.name === w.name) + 1 || '–'} · ${num(((ch.view.after.drivers || []).find(d => d.name === w.name) || {}).total || 0)} pts`,
            'ch'
          )
        : '';
    const goLabel = ch && ch.next ? `Go to ${ch.next.short || 'the next round'}` : '';
    const first = goLabel ? btn('champ-next', goLabel, true) + btn('home', 'Back to Home') : btn('home', 'Back to Home', true);
    const kicker =
      (ch
        ? `<span class="ro-chk">${esc(ch.name)} · ${esc(ch.view.roundLabel || 'round ' + ch.view.round)} of ${esc(ch.view.total)}</span> · `
        : '') + esc(o.kicker || '');
    const top = hero({
      kicker,
      big: o.event ? w.name : `${w.name} wins`,
      more: o.event ? 'wins the event' : leads ? '& leads' : '',
      sub: o.eventLine || winLine(f),
      chips: champChip + (o.eventChips || raceChips(f)),
      picture: pictureOf(w, w.lane),
      place: 1,
      bar: actionsBar({ ...o, again: o.again && !ch }, first), // (a championship goes on to its next session: Go to … instead of Race again)
      saved: o.saved
    });
    const left = o.event
      ? o.standingsCard
      : card(
          ch ? 'This race' : 'Classification',
          esc(o.note || ''),
          tower(f.rows, { ...o, fastest: f.fastest, compact: !!ch }) + checkedHtml(o.checked)
        );
    const right = ch
      ? champCard(ch.view, ch)
      : o.event
        ? o.finalCard || ''
        : storyCard(f, o) || card('Highlights', '', `<div class="ro-chips">${raceChips(f)}</div>`);
    return `<div class="ro-screen">${top}${o.event ? o.trackCard || '' : ''}<div class="ro-main${ch ? ' eq' : ''}">${left}${right}</div>${ch && !o.tv ? nextRound(ch.next, ch.name) : ''}${o.tv ? tvFoot(o.foot) : ''}</div>`;
  }
  // nothing to show (no driver in the standings): the actions only
  function emptyHtml(o) {
    return `<div class="ro-screen">${hero({ kicker: esc(o.kicker || ''), big: 'Race over', sub: 'No laps were counted.', bar: actionsBar({ ...o, again: o.again }, btn('home', 'Back to Home', true)), saved: o.saved })}</div>`;
  }
  // the heats as a strip: done (with the winner), next, later
  function heatTrack(list) {
    return `<section class="ro-card ro-heats"><ul class="ro-trk" aria-label="The heats">${list
      .map(
        h =>
          `<li class="${h.state === 'done' ? 'done' : h.state === 'next' || h.state === 'current' ? 'next' : 'later'}"${h.state === 'next' ? ' aria-current="step"' : ''}><b>${esc(h.name)}</b><span>${h.state === 'done' && h.winner ? esc(h.winner.name) + ' won' : h.again ? 'run again' : h.state === 'next' ? 'next' : '&nbsp;'}${h.state === 'done' && h.reruns ? ` <i class="ro-tag">${h.reruns === 1 ? 'Run twice' : 'Run ' + (h.reruns + 1) + ' times'}</i>` : ''}${h.state === 'done' && h.changes ? ` <i class="ro-tag">${h.changes} ${h.changes === 1 ? 'change' : 'changes'}</i>` : ''}</span></li>`
      )
      .join('')}</ul></section>`;
  }
  // the standings of an event of heats: a column per heat (the best score of every heat lit), the final, this heat's points, the total with a bar
  // rows: [{ pos, name, lane, heats: [pts|null per heat], final, add, move, total }]; o.byPoints, o.heatNames, o.showAdd, o.showMove
  function heatStandings(rows, o = {}) {
    const names = o.heatNames || [],
      tops = names.map((_, k) => rows.reduce((m, r) => (Number.isFinite(r.heats[k]) && r.heats[k] > m ? r.heats[k] : m), -Infinity)),
      top = rows.reduce((m, r) => (Number.isFinite(r.total) && r.total > m ? r.total : m), 0);
    const head = `<tr><th>Pos</th><th>Driver</th>${o.showMove ? '<th class="c">Move</th>' : ''}${names.map(n => `<th class="c">${esc(n)}</th>`).join('')}${o.finals ? '<th class="c">Final</th>' : ''}${o.showAdd ? '<th class="r">This heat</th>' : ''}<th class="r">${o.byPoints ? 'Points' : 'Laps'}</th></tr>`;
    const body = rows
      .map(r => {
        const c = colorOf(o, r.lane),
          mv = !o.showMove
            ? ''
            : `<td class="c">${r.move > 0 ? `<span class="ro-mv up">▲ ${r.move}</span>` : r.move < 0 ? `<span class="ro-mv dn">▼ ${-r.move}</span>` : '<span class="ro-mv eq">–</span>'}</td>`;
        return `<tr><td><span class="ro-pos sm p${esc(r.pos)}">${esc(r.pos)}</span></td><td${c ? ` style="--c:${esc(c)}"` : ''}><span class="ro-dot"></span><b>${esc(r.name)}</b></td>${mv}${names
          .map((_, k) => {
            const v = r.heats[k];
            return `<td class="h${!Number.isFinite(v) ? ' no' : o.byPoints && v === tops[k] && v > 0 ? ' top' : ''}">${Number.isFinite(v) ? esc(num(v)) : '–'}</td>`;
          })
          .join(
            ''
          )}${o.finals ? `<td class="h">${esc(r.final || '–')}</td>` : ''}${o.showAdd ? `<td class="r">${Number.isFinite(r.add) ? `<span class="ro-plus">+${esc(num(r.add))}</span>` : ''}</td>` : ''}<td class="ro-pts" style="--w:${top > 0 ? Math.round((100 * (r.total || 0)) / top) : 0}%">${esc(num(r.total))}<i></i></td></tr>`;
      })
      .join('');
    return `<table class="ro-st">${head}${body}</table>`;
  }
  // the result of one heat (or a final) as a result board: the winner in a gold lower third, the others with the gap and the points
  function heatResult(h, o = {}) {
    const rows = h.rows || [];
    if (!rows.length) return '';
    const w = rows[0],
      wc = colorOf(o, w.lane);
    const pts = r => (o.byPoints && Number.isFinite(r.points) ? `<span class="ro-plus">+${esc(num(r.points))}</span>` : '');
    return `<div class="ro-wb"><div class="w"${wc ? ` style="--c:${esc(wc)}"` : ''}>${pictureOf(w, w.lane) ? `<img src="${esc(pictureOf(w, w.lane))}" alt="">` : '<span></span>'}<div><b>${esc(w.name)}</b><small>${esc([w.car, Number.isInteger(w.lane) ? 'lane ' + (w.lane + 1) : '', w.laps !== undefined ? plural(w.laps, 'lap', 'laps') : ''].filter(Boolean).join(' · '))}</small></div>${pts(w)}</div>${rows
      .slice(1)
      .map(r => {
        const c = colorOf(o, r.lane);
        return `<div class="o"${c ? ` style="--c:${esc(c)}"` : ''}><span class="p">${esc(r.pos)}</span><span class="ro-dot"></span><span>${esc(r.name)}</span><span class="ro-gap">${esc(r.gap || '')}</span>${pts(r)}</div>`;
      })
      .join('')}</div>`;
  }
  // (2.4.0, SlotForgeRestyle.md "Finalize Review") what the review changed in a race before it was saved, under its result: ck = { reruns, changes: [{ kind, name, text, from, to }] }
  const ord = n => (Number.isInteger(n) ? n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th') : 'DQ');
  function checkedHtml(ck) {
    const list = (ck && ck.changes) || [];
    if (!list.length && !(ck && ck.reruns)) return '';
    const n = list.length;
    return `<div class="ro-checked"><span class="k">Result checked${n ? ` · ${n} ${n === 1 ? 'change' : 'changes'}` : ''}</span><ul>${ck.reruns ? `<li>Run again ${ck.reruns === 1 ? 'once' : ck.reruns + ' times'}: only the run that was finalized counts</li>` : ''}${list
      .map(c => `<li><b>${esc(c.name)}</b> · ${esc(c.text)}${c.from !== c.to ? ` <em>${ord(c.from)} → ${ord(c.to)}</em>` : ''}</li>`)
      .join('')}</ul></div>`;
  }
  // the runs of a race that were set aside with Run again (the break before it is run again)
  function asideHtml(a) {
    const runs = (a && a.runs) || [];
    return `<div class="ro-aside">${runs
      .map(
        (r, i) =>
          `<p>${runs.length > 1 ? `Run ${i + 1}` : 'The first run'} is set aside: <s>${esc(r.result)}</s>${r.changes ? ` <small>(with ${r.changes} ${r.changes === 1 ? 'change' : 'changes'} made in its review)</small>` : ''}</p>`
      )
      .join('')}<p>When ${esc(
      String(a.name || '')
        .replace(/^Heat/, 'heat')
        .replace(/^Final/, 'final')
    )} is run again, only that run counts in the standings.</p></div>`;
  }
  // the break between two heats: the next heat big with its line-up as lane tiles and Start; the heats; the standings; the heat that was just driven
  // o = { kicker, next: { name, line, drivers: [{ name, car, lane, avatar, total }] }, startable, startNote, track (heat list), standings, last, byPoints, saved }
  function breakHtml(o) {
    const nx = o.next || { name: 'The next heat', drivers: [] };
    const tiles = nx.drivers.length
      ? `<div class="ro-lu" aria-label="The line-up of ${esc(nx.name)}">${nx.drivers
          .map((d, i) => {
            // (a final before the lanes are chosen: no lane yet, so a helmet in grey)
            const c = colorOf(o, d.lane),
              noLane = !Number.isInteger(d.lane),
              pic = pictureOf(d, d.lane) || pictureOf(null, i % 8);
            return `<div class="ro-lt${noLane ? ' nolane' : ''}"${c ? ` style="--c:${esc(c)}"` : ''}><span class="n">${Number.isInteger(d.lane) ? d.lane + 1 : '–'}</span>${o.byPoints && Number.isFinite(d.total) ? `<span class="pt">${esc(num(d.total))} pts</span>` : ''}${pic ? `<img src="${esc(pic)}" alt="">` : '<span class="ro-noimg"></span>'}<b>${esc(d.name)}</b><small>${esc(d.car || '')}</small></div>`;
          })
          .join('')}</div>`
      : '';
    const go = o.tv
      ? `<div class="ro-tvcount" data-tv-left hidden><small>Starts in</small><b></b></div>`
      : o.startable
        ? `<div class="ro-go"><button type="button" class="btn primary ro-start" data-ro="start">Start ${esc(nx.name.replace(/^Heat/, 'heat').replace(/^Final/, 'final'))}</button><kbd>Space</kbd><span>starts it too</span></div>`
        : `<div class="ro-go"><p class="ro-sub">${esc(o.startNote || 'Choose the lanes of the final first.')}</p></div>`;
    const top = `<div class="ro-hero brk"><div class="ro-chq" aria-hidden="true"></div><div class="ro-hin"><div class="ro-words"><div class="ro-k">${esc(o.kicker || '')}</div><h2 class="ro-big">${esc(nx.name)} <em>${o.again ? 'run again' : 'next up'}</em></h2>${nx.line ? `<p class="ro-sub">${esc(nx.line)}</p>` : ''}${go}</div>${tiles}</div><div class="ro-bar" role="group" aria-label="The break">${btn('screen', 'Show the race screen')}${btn('heatprint', 'Print the heat list')}<span class="ro-grow"></span><button type="button" class="btn ro-quietdanger" data-ro="endevent">End the event…</button>${o.saved ? `<span class="ro-saved" role="status">${o.saved}</span>` : ''}</div></div>`;
    const picks = o.picks && !o.tv ? `<div class="ro-picks" id="ro-picks"></div>` : '';
    return `<div class="ro-screen">${top}${picks}${heatTrack(o.track || [])}<div class="ro-main">${card('Standings', esc(o.standingsNote || ''), o.standings)}${o.aside ? card(o.aside.name, 'set aside · not counted', asideHtml(o.aside), 'ro-againcard') : o.last ? card(o.last.name, esc(o.last.note || ''), heatResult(o.last, o) + (o.last.fastest ? `<div class="ro-chips">${chip('Fastest lap', `${esc(s3(o.last.fastest.time))} · ${esc(o.last.fastest.name)}`, 'fl')}</div>` : '') + checkedHtml(o.last.checked)) : ''}</div>${o.tv ? tvFoot(o.foot) : ''}</div>`;
  }

  // (the second screen) the line along the bottom: a small kicker, what comes next in Barlow, and the name of the app on the right
  function tvFoot(f) {
    if (!f) return '';
    return `<div class="ro-tvfoot"><span class="k">${esc(f.kicker || '')}</span>${(f.items || []).map(x => `<b class="${esc(x.cls || '')}">${esc(x.text)}</b>`).join('')}${f.note ? `<span class="n">${esc(f.note)}</span>` : ''}<span class="r">SlotForge Timing</span></div>`;
  }
  // the screens for the second screen (the Live Race window): the same, without the buttons, on one 16:9 screen (.ro-tv), the line along the bottom
  const tvHtml = (kind, o) =>
    `<div class="ro-host ro-tv">${kind === 'break' ? breakHtml({ ...o, tv: true }) : overHtml({ ...o, tv: true })}</div>`;

  const api = {
    tvHtml,
    tvFoot,
    card,
    figures,
    overHtml,
    breakHtml,
    heatStandings,
    heatResult,
    heatTrack,
    checkedHtml,
    asideHtml,
    champCard,
    nextRound,
    tower,
    storyCard,
    raceChips,
    winLine,
    pictureOf,
    hero
  };
  root.RaceOver = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
