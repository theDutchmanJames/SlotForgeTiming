// Builds the printable report for one session: page 1 = results, page 2 onwards = every lap time.
// Pure (it only returns HTML), so it can be tested without a screen; the app turns the HTML into a PDF.
(function (root) {
  const E = typeof module !== 'undefined' ? require('./engine.js') : root.RaceEngine;
  const RT = typeof module !== 'undefined' ? require('./richtext.js') : root.RichText;
  const HT = typeof module !== 'undefined' ? require('./heats.js') : root.Heats;
  const ST = typeof module !== 'undefined' ? require('./stats.js') : root.Stats;
  const IC = typeof module !== 'undefined' ? require('./icons.js') : root.Icons;
  const VR = typeof module !== 'undefined' ? require('./virtualrival.js') : root.VirtualRival;
  const RR = typeof module !== 'undefined' ? require('./racereport.js') : root.RaceReport; // (2.4.0: the look of the race report on paper)
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const LABEL = {
    practice: 'Free practice',
    qualifying: 'Qualifying',
    race: 'Race',
    timed: 'Timed race',
    heats: 'Heat-based race',
    endurance: 'Endurance Race',
    tokens: 'Time Token Session'
  };
  const dateText = iso => (iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' }) : '');

  // laps of one session, grouped (one group, or one per heat), each as columns of lap times per driver
  function lapGroups(session, laps) {
    const heatNumbers = [...new Set(laps.map(l => l.heat || 0))].sort((a, b) => a - b);
    return heatNumbers
      .map(h => {
        const mine = laps.filter(l => (l.heat || 0) === h);
        const cols = session.standings
          .filter(s => ST.ownLaps(s, mine).length)
          .map(s => ({ s, laps: ST.ownLaps(s, mine).sort((a, b) => a.lapNumber - b.lapNumber) }));
        return { heat: h, final: (mine.find(l => l.final) || {}).final || '', cols };
      })
      .filter(g => g.cols.length);
  }

  // What goes in the PDF. options (all optional, everything is in when it is left out): results (the table), heats (the summary of the heats and finals), tyres (the tyre stints of a race with Tyre Wear; tyreWorn: the laps on worn out tyres end the bar in red), laps (the page with every lap time),
  // columns (the keys of the columns of the table, as Stats.SESSION_COLUMNS names them; the default is the ones that are on until turned off).
  // tracks and cars (the lists from the database) give the length and scale for the speeds; unit ('kmh' or 'mph', the setting speedUnit) is the unit they are written in; distUnit ('m' or 'ft', the setting distanceUnit, 1.27.0) is the one of the distance.
  const DEFAULT_OPTIONS = { results: true, heats: true, tyres: true, laps: true, drivers: true, mode: 'colour' }; // (2.4.0: drivers, a page for every driver; mode, 'colour' or 'mono')
  // One cell of the results table. plain: as text (CSV, a message), else as HTML (the PDF, the web page). (2.3.0: shared by both)
  function cellMaker({ session, figs, cols, unit, distUnit, finArg }, plain) {
    const e = plain ? v => String(v ?? '') : esc,
      cup = plain ? '' : IC.trophy({ size: 14 }),
      hasDriver = cols.some(c => c.key === 'driver'); // (the winner's cup goes next to the name; without the Driver column next to the position)
    return (key, x, i) => {
      switch (key) {
        case 'pos':
          return e(x.pos) + (!hasDriver && cup && ST.isWinner(session, x) ? ' ' + cup : '');
        case 'driver':
          return (
            (cup && ST.isWinner(session, x) ? cup + ' ' : '') +
            e(x.driverName) +
            (ST.outText(x) ? ` (${ST.outText(x)})` : '') +
            (ST.adjustedText(x) ? ` (adjusted: ${e(ST.adjustedText(x))})` : '') +
            (ST.notesText(x) ? ` (${e(ST.notesText(x))})` : '') +
            (ST.driversText(x, distUnit) ? ` (drivers: ${e(ST.driversText(x, distUnit))})` : '') +
            (ST.enduranceText(x, distUnit) ? ` (${e(ST.enduranceText(x, distUnit))})` : '')
          );
        case 'team':
          return e(x.teamName || '');
        case 'car':
          return e(x.carName);
        case 'laps':
          return e(x.laps) + (ST.sectorText(x) ? ` + ${e(ST.sectorText(x))}` : '');
        case 'points':
          return e(x.points);
        case 'result':
          return e(HT.scoreText(x, session.scoring, finArg));
        case 'final':
          return e(HT.finalCell(x));
        case 'best':
          return e(E.fmtTime(x.best));
        case 'total':
          return (
            e(E.fmtTime(typeof x.total === 'number' ? x.total + (x.penalty || 0) + (x.adjMs || 0) : null)) +
            (x.penalty
              ? x.penaltyPoints != null
                ? ` (includes +${e(E.fmtTime(x.penalty))} penalty, ${e(x.penaltyPoints)} points)`
                : ` (includes +${e(E.fmtTime(x.penalty))} added time)`
              : '')
          ); // (2.2.5: time added without a penalty system, such as the red-flag time, has no points)
        default:
          return e(ST.text(key, figs[i], unit, distUnit));
      }
    };
  }
  function sessionHtml({ session, laps, tracks, cars, options, unit, distUnit }) {
    const opt = { ...DEFAULT_OPTIONS, ...(options || {}) };
    const pts = session.resultBy === 'points',
      isHeats = ST.heated(session);
    const fin = isHeats && !!session.finals,
      finArg = { finalMode: fin ? session.finals.finalMode : 'places', byPoints: pts, unit: distUnit };
    const figs = ST.forSession(session, laps, tracks, cars),
      want = new Set(opt.columns || ST.SESSION_COLUMNS.filter(c => c.on).map(c => c.key));
    const cols = ST.sessionColumns(session, figs).filter(c => want.has(c.key));
    const cup = IC.trophy({ size: 14 });
    const cellOf = cellMaker({ session, figs, cols, unit, distUnit, finArg }, false);
    const standings =
      !opt.results || !cols.length
        ? ''
        : `<table${cols.length > 8 ? ' class="wide"' : ''}><thead><tr>${cols.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>` +
          session.standings
            .map(
              (x, i) =>
                `<tr${RR && Math.round(Number(x.lane)) > 0 ? ` style="--c:${RR.laneColor(x.lane)}"` : ''}>${cols.map(c => `<td>${cellOf(c.key, x, i)}</td>`).join('')}</tr>`
            )
            .join('') +
          '</tbody></table>' +
          (ST.notes(cols.map(c => c.key)).length
            ? `<p class="sub">${ST.notes(cols.map(c => c.key))
                .map(esc)
                .join(' ')}</p>`
            : '') +
          (isHeats && session.scoring && HT.scoringText(session.scoring, pts)
            ? `<p class="sub">${esc(HT.scoringText(session.scoring, pts))}</p>`
            : '') +
          (fin ? `<p class="sub">${esc(HT.finalsSaid(session.finals))}</p>` : '') +
          (ST.weatherText(session) ? `<p class="sub">${esc(ST.weatherText(session))}</p>` : '') +
          (ST.resumeText(session) ? `<p class="sub">${esc(ST.resumeText(session))}</p>` : '') +
          (ST.compareText(session) ? `<p class="sub">${esc(ST.compareText(session))}</p>` : '');
    const heatSummary =
      !opt.heats || !session.heatResults
        ? ''
        : `<h2>${session.finals ? 'Heats and finals' : 'Heats'}</h2>` +
          session.heatResults
            .map(
              h =>
                `<p><b>${esc(HT.raceName(h))}</b>${ST.weatherText(h) ? ` (${esc(ST.weatherText(h))})` : ''}: ${h.rows.map(r => `${esc(r.pos)}. ${ST.isHeatWinner(session, r) ? cup + ' ' : ''}${esc(r.driverName)} (${esc(r.laps)} laps${ST.sectorText(r) ? ' + ' + esc(ST.sectorText(r)) : ''}${esc(ST.heatTimeText(session, r))}${pts ? ', ' + esc(r.points) + ' pts' + (r.bonus ? ' incl. ' + esc(r.bonus) + ' for the fastest lap' : '') : ''}${ST.adjustedText(r) ? ', adjusted: ' + esc(ST.adjustedText(r)) : ''}${ST.notesText(r) ? ', ' + esc(ST.notesText(r)) : ''})`).join(' &middot; ')}</p>`
            )
            .join('');
    const stintSheet =
      !opt.results || !ST.stintLines(session, distUnit).length
        ? ''
        : '<h2>Driver swaps</h2>' +
          ST.stintLines(session, distUnit)
            .map(g => `<p><b>${esc(g.team)}</b>: ${g.stints.map(q => `${esc(q.n)}. ${esc(q.text)}`).join('; ')}</p>`)
            .join('');
    const tyreSheet =
      !opt.tyres || !ST.tyreStints(session, distUnit).length
        ? ''
        : '<h2>Tyre stints</h2>' +
          ST.tyreStintsHtml(session, { distUnit, worn: !!opt.tyreWorn }) +
          `<p class="sub">${esc(ST.tyreStintsNote(session))}</p>`;
    const groups = lapGroups(session, laps);
    const lapPages = groups
      .map(g => {
        const most = Math.max(...g.cols.map(c => c.laps.length));
        const bad = x => x.invalid || x.tooSlow;
        const bestByColumn = g.cols.map(c => c.laps.reduce((best, l) => (bad(l) ? best : Math.min(best, l.time)), Infinity));
        const rows = Array.from(
          { length: most },
          (_, i) =>
            `<tr><td>${i + 1}</td>${g.cols
              .map(c => {
                const l = c.laps[i];
                if (!l) return '<td></td>';
                const best = bestByColumn[g.cols.indexOf(c)];
                const tm = esc(E.fmtTime(l.time));
                return `<td>${bad(l) ? `<s title="${l.invalid ? 'invalid lap' : 'too slow'}">${tm}</s>` : l.time === best ? `<b>${tm}</b>` : l.pit ? `<i title="pit stop">${tm}</i>` : tm}</td>`;
              })
              .join('')}</tr>`
        ).join('');
        return `${isHeats ? `<h2>${esc(HT.raceName(g))}</h2>` : ''}<table class="laps"><thead><tr><th>Lap</th>${g.cols.map(c => `<th>${esc(c.s.driverName)}<br><span class="sub">${esc(c.s.carName)}</span></th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
      })
      .join('');
    // (2.4.0, SlotForgeRestyle.md "Race Report PDF") page one: the head, the podium, the classification, the race notes and the laps per lane, then the
    // heats, swaps and tyres; then a page for every driver; then every lap time when it is chosen. Colour or Monochrome (opt.mode).
    const mono = opt.mode === 'mono',
      racing = session.sessionType !== 'tokens' && !!RR,
      rows = session.standings || [],
      F = racing ? RR.facts(session, laps, figs) : null,
      drivers =
        racing && opt.drivers ? rows.map((x, i) => ({ x, i })).filter(({ x, i }) => !x.virtual && F.per[i] && F.per[i].list.length) : [];
    const meta = `${esc(LABEL[session.sessionType] || '')} &middot; ${esc(session.trackName || '')} &middot; ${esc(dateText(session.date))}${session.endedBy ? ' &middot; ' + esc(session.endedBy) : ''}${rows.length ? ` &middot; ${rows.length} ${rows.length === 1 ? 'driver' : 'drivers'}` : ''}`;
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(session.setupName)}</title><style>
      ${RR ? RR.css(mono) : '@page { size: A4; margin: 15mm; } thead { display: table-header-group; } .page2 { page-break-before: always; }'}
      .tys-row { display: flex; align-items: flex-start; gap: 10px; padding: 5px 0; border-bottom: 1px solid #ccc; page-break-inside: avoid; } .tys-head { color: #666; font-size: 8pt; padding-bottom: 2px; }
      .tys-nm { flex: none; width: 70px; font-weight: bold; padding-top: 4px; } .tys-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; } .tys-grp { font-size: 8pt; color: #666; }
      .tys-strip { display: flex; gap: 3px; } .tys-seg { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .tys-bar { position: relative; height: 22px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 8.5pt; font-weight: bold; overflow: hidden; white-space: nowrap; box-sizing: border-box; padding: 0 3px; border: 1px solid #999; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .tys-bar span { position: relative; z-index: 1; } .tys-worn { position: absolute; right: 0; top: 0; bottom: 0; background: repeating-linear-gradient(135deg, #e5484d 0 4px, #a01e24 4px 8px); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .tys-end { font-size: 8pt; color: #555; text-align: right; white-space: nowrap; } .tys-ok { color: #1c7d52; } .tys-warn { color: #a36a00; } .tys-crit, .tys-bad { color: #c0262d; font-weight: bold; }
      .tys-sum { flex: none; width: 170px; display: grid; grid-template-columns: 34px 52px 1fr; gap: 2px 6px; font-size: 9pt; text-align: right; padding-top: 4px; } .tys-head .tys-sum { padding-top: 0; } .tys-head .tys-sum b { font-weight: normal; white-space: nowrap; }
    </style></head><body class="${mono ? 'pdf-mono' : 'pdf-colour'}">${RR ? RR.defs(mono) : ''}
      <main class="rp-page1">${RR ? RR.head({ session, kicker: 'Race report' + (LABEL[session.sessionType] ? ' · ' + LABEL[session.sessionType] : ''), title: session.setupName || 'Race', sub: meta, right: '<span class="rp-mark"><!--SF-PDF-WORDMARK--></span>' }) : `<h1>${esc(session.setupName)}</h1><p class="meta">${meta}</p>`}
      ${racing && opt.results ? RR.podium(session, rows, figs) : ''}
      ${standings ? '<section class="rp-class"><h2>' + (session.virtualRivals?.length ? 'Physical-field standings' : 'Results') + '</h2>' + standings + '</section>' : ''}
      ${racing && opt.results ? RR.middle(F, rows, session, mono) : ''}
      <div class="rp-extra">${opt.results && VR ? VR.historyHtml(session) : ''}${opt.results ? (typeof module !== 'undefined' ? require('./multiclass.js') : MultiClass).resultsHtml(session.classStandings || [], session.multiclass) : ''}${heatSummary ? `<section class="rp-heats">${heatSummary}</section>` : ''}${stintSheet ? `<section class="rp-section">${stintSheet}</section>` : ''}${tyreSheet ? `<section class="rp-section">${tyreSheet}</section>` : ''}</div>
      <footer class="rp-foot"><span>Made with SlotForge Timing</span><span>${drivers.length ? `Page 1 · a page for every driver follows (${drivers.length})` : ''}</span></footer></main>
      ${drivers.map(({ x, i }) => RR.driverPage({ session, x, i, rows, fig: figs[i], F, count: drivers.length, raceTitle: session.setupName || 'Race', mono })).join('')}
      ${
        opt.laps
          ? `<div class="page2"><span class="rp-k">Every lap time</span><h1>All lap times</h1><p class="meta">${esc(session.setupName)} &middot; ${esc(session.trackName || '')} &middot; ${esc(dateText(session.date))}. The fastest lap of each driver is in bold.${laps.some(l => l.pit) ? ' A lap with a pit stop is in italics.' : ''}</p>${lapPages || '<p>No laps were recorded.</p>'}
      <p class="foot">Made with SlotForge Timing</p></div>`
          : ''
      }</body></html>`;
  }

  // A page to print: the QR code of a network address, big enough to scan from a print on the wall
  function qrHtml({ title, url, svg }) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      @page { size: A4; margin: 15mm; }
      body { font: 14pt/1.4 Arial, Helvetica, sans-serif; color: #111; margin: 0; text-align: center; }
      h1 { font-size: 34pt; margin: 10mm 0 4mm; } p { margin: 3mm 0; color: #333; }
      .qr { width: 150mm; height: 150mm; margin: 8mm auto; } .qr svg { width: 100%; height: 100%; display: block; }
      .url { font: bold 20pt Consolas, monospace; color: #000; word-break: break-all; } .small { font-size: 11pt; color: #666; }
    </style></head><body><h1>${esc(title)}</h1><p>Scan this code with your phone camera to follow the race live.</p>
      <div class="qr">${svg}</div><p class="url">${esc(url)}</p><p class="small">Your phone must be on the same wifi network as the timing computer.</p></body></html>`;
  }

  // The credit under the racing rules on the screen (Racing Rules tab). It is not on the printed page: that is the club's own page.
  const CREDIT = [
    'This App has been made by theDutchmanJames, Codex & Claude.',
    'Special thanks to Bjorn and Joanne and the members of:',
    '@SlotForum.com: Kevan, Roguejackal, Dangermouse, Dopamine, LMP & Superslab, Slotranger, Angelsoft'
  ];
  // The racing rules as a page to hand out: the club's own formatting and a clear title (no credit on it)
  function rulesHtml({ title, html }) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      @page { size: A4; margin: 18mm; }
      body { font: 12pt/1.5 Arial, Helvetica, sans-serif; color: #111; margin: 0; }
      h1.title { font-size: 26pt; margin: 0 0 2mm; padding-bottom: 3mm; border-bottom: 2px solid #111; }
      .body h1, .body h2, .body h3 { margin: 1em 0 .3em; page-break-after: avoid; } .body ul, .body ol { padding-left: 1.4em; } .body li, .body p { page-break-inside: avoid; }
      .body blockquote { margin: .6em 0; padding: .2em 0 .2em 1em; border-left: 3px solid #999; color: #333; } .body hr { border: 0; border-top: 1px solid #999; margin: 1.2em 0; }
    </style></head><body><h1 class="title">${esc(title)}</h1><div class="body">${RT.clean(html)}</div></body></html>`;
  }

  // The heat list as a sheet to hand out or pin up: a row per heat with the driver of every lane, and a place to write the winner. list: Heats.listOf(...) entries;
  // lanes: the lanes of the track; points: show what a finished heat gave (points, or the time of the result); a heat that is finished shows its winner.
  function heatSheetHtml({ title, subtitle, list, lanes, points, time }) {
    const n = Math.max(
      1,
      Math.floor(Number(lanes)) ||
        Math.max(1, ...list.map(x => x.drivers.reduce((m, d) => Math.max(m, Number.isInteger(d.lane) ? d.lane + 1 : 0), 0)))
    );
    const drivers = x =>
      Array.from({ length: n }, (_, l) => {
        const d = x.drivers.find(y => y.lane === l);
        return `<td>${d ? esc(d.name) : '&ndash;'}</td>`;
      }).join('');
    const unplaced = x => x.drivers.filter(d => !(Number.isInteger(d.lane) && d.lane >= 0)); // (a final, before its lanes are chosen)
    const result = x =>
      x.rows.length
        ? x.rows
            .map(
              r =>
                `${esc(r.pos)}. ${esc(r.name)}${HT.rowFigure(r, { points, time }) ? ' (' + esc(HT.rowFigure(r, { points, time })) + ')' : ''}`
            )
            .join(', ')
        : '';
    const anyResult = list.some(x => x.rows.length);
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      @page { size: A4 landscape; margin: 14mm; }
      body { font: 12pt/1.4 Arial, Helvetica, sans-serif; color: #111; margin: 0; }
      h1 { font-size: 22pt; margin: 0 0 1mm; } p.sub { margin: 0 0 5mm; color: #555; }
      table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #888; padding: 2.4mm 3mm; text-align: left; vertical-align: top; } th { background: #eee; }
      td.win { width: 28%; } tr { page-break-inside: avoid; } td.h { white-space: nowrap; font-weight: bold; }
    </style></head><body><h1>${esc(title)}</h1><p class="sub">${esc(subtitle || '')}</p>
      <table><thead><tr><th>Heat</th>${Array.from({ length: n }, (_, l) => `<th>Lane ${l + 1}</th>`).join('')}<th>${anyResult ? 'Result' : 'Winner'}</th></tr></thead><tbody>${list
        .map(
          x =>
            `<tr><td class="h">${esc(x.name)}${x.label ? `<br><span style="font-weight:normal">${esc(x.label)}</span>` : ''}</td>${unplaced(x).length === x.drivers.length && x.drivers.length ? `<td colspan="${n}">${esc(HT.andList(x.drivers.map(d => d.name)))} (lanes are chosen before the final)</td>` : drivers(x)}<td class="win">${result(x)}</td></tr>`
        )
        .join('')}</tbody></table>
    </body></html>`;
  }

  // The standings of a championship as a page to print (1.56.0): the table that ChampPts.tableOf makes ({ title, note, columns, rows, legend }) under the name of the championship.
  // A dropped result is crossed out, a fastest lap bonus is bold, the leader's row is shaded. The page is landscape: a championship has many rounds.
  function standingsHtml({ championship, table, lead }) {
    const t = table || { title: '', columns: [], rows: [], legend: [] },
      cls = c => (c ? ` class="${esc(c)}"` : '');
    const head = t.columns
      .map(c => `<th${c.r ? ' class="r"' : ''}${c.title ? ` title="${esc(c.title)}"` : ''}>${esc(c.label)}</th>`)
      .join('');
    const body = t.rows
      .map(
        r =>
          `<tr${r.lead ? ' class="lead"' : ''}>${r.cells.map((c, i) => `<td${(t.columns[i] || {}).r ? ` class="r${c.cls ? ' ' + esc(c.cls) : ''}"` : cls(c.cls)}>${c.b ? `<b${c.big ? ' class="big"' : ''}>${esc(c.t)}</b>` : esc(c.t)}</td>`).join('')}</tr>`
      )
      .join('');
    const legend = (t.legend || []).map(l => `<span${cls(l.cls)}>${esc(l.text)}</span>`).join(' &nbsp;&middot;&nbsp; ');
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(championship)}</title><style>
      @page { size: A4 landscape; margin: 14mm; }
      body { font: 11pt/1.4 Arial, Helvetica, sans-serif; color: #111; margin: 0; }
      h1 { font-size: 22pt; margin: 0 0 1mm; } p.sub { margin: 0 0 5mm; color: #555; } p.foot { color: #777; font-size: 9pt; margin-top: 8mm; }
      table { border-collapse: collapse; width: 100%; } th, td { border-bottom: 1px solid #ccc; padding: 2mm 2.5mm; text-align: left; font-variant-numeric: tabular-nums; white-space: nowrap; } th { background: #eee; }
      .r { text-align: right; } .big { font-size: 13pt; } tr.lead td { background: #fde8f1; -webkit-print-color-adjust: exact; print-color-adjust: exact; } tr { page-break-inside: avoid; }
      .dr { color: #888; text-decoration: line-through; } .fl { font-weight: bold; color: #b8326f; } .mu { color: #888; }
    </style></head><body><h1>${esc(championship)}</h1><p class="sub">${esc(t.title)}${t.note ? ' &middot; ' + esc(t.note) : ''}${lead ? ' &middot; ' + esc(lead) : ''}</p>
      <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>${legend ? `<p class="sub">${legend}</p>` : ''}<p class="foot">Made with SlotForge Timing</p></body></html>`;
  }
  const standingsFileName = (name, which) =>
    `${name || 'Championship'} ${which === 'teams' ? 'teams' : which === 'rounds' ? 'rounds' : 'drivers'} standings.pdf`.replace(
      /[\\/:*?"<>|]/g,
      '-'
    );

  // the day of a race as the page shows it (local time): a race at 00:30 in Amsterdam is on the new day, not on the day of the UTC date
  const dayOf = iso => {
    const t = Date.parse(iso),
      d = new Date(t),
      two = n => String(n).padStart(2, '0');
    return Number.isFinite(t) ? `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}` : String(iso || '').slice(0, 10);
  };
  const fileName = session => `${session.setupName || 'Session'} ${dayOf(session.date)}.pdf`.replace(/[\\/:*?"<>|]/g, '-');
  // ---- sharing (2.3.0): the results as a CSV file (for a spreadsheet) and as a short text (a club chat, such as WhatsApp) ----
  // columns: as for the PDF (the keys of Stats.SESSION_COLUMNS); default: the ones that are on until turned off
  function sessionTable({ session, laps, tracks, cars, columns, unit, distUnit }) {
    const pts = session.resultBy === 'points',
      fin = ST.heated(session) && !!session.finals,
      finArg = { finalMode: fin ? session.finals.finalMode : 'places', byPoints: pts, unit: distUnit },
      figs = ST.forSession(session, laps || [], tracks || [], cars || []),
      want = new Set(columns || ST.SESSION_COLUMNS.filter(c => c.on).map(c => c.key)),
      cols = ST.sessionColumns(session, figs).filter(c => want.has(c.key)),
      cell = cellMaker({ session, figs, cols, unit, distUnit, finArg }, true);
    return { header: cols.map(c => c.label), rows: (session.standings || []).map((x, i) => cols.map(c => cell(c.key, x, i))) };
  }
  const csvCell = v => {
    const t = String(v ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    return /[",;\n]/.test(t) || /^[=+\-@]/.test(t) ? '"' + (/^[=+\-@]/.test(t) ? "'" : '') + t.replace(/"/g, '""') + '"' : t; // (a cell that starts with = is not run as a formula by a spreadsheet)
  };
  function sessionCsv(o) {
    const t = sessionTable(o),
      s = o.session;
    const lines = [
      [s.setupName || 'Session', LABEL[s.sessionType] || '', s.trackName || '', dateText(s.date)].map(csvCell).join(','),
      '',
      t.header.map(csvCell).join(','),
      ...t.rows.map(r => r.map(csvCell).join(','))
    ];
    return '\ufeff' + lines.join('\r\n') + '\r\n'; // (the mark at the start makes Excel read the names with accents right)
  }
  function sessionText({ session, laps }) {
    const s = session,
      medal = ['🥇', '🥈', '🥉'],
      rows = (s.standings || []).filter(x => x && x.driverName),
      byLaps = ST.WINNER_TYPES.includes(s.sessionType);
    const fastest = (laps || [])
      .filter(l => !l.invalid && !l.tooSlow && Number(l.time) > 0)
      .reduce((b, l) => (!b || l.time < b.time ? l : b), null);
    const fastName = fastest
      ? (rows.find(x => (x.driverId && x.driverId === fastest.driverId) || x.lane === fastest.lane) || {}).driverName
      : '';
    return [
      `🏁 ${s.setupName || 'Session'}${s.trackName ? ' · ' + s.trackName : ''}`,
      dateText(s.date),
      '',
      ...rows.map((x, i) => {
        const pos = Number(x.pos) || i + 1;
        const what = byLaps
          ? [x.laps !== undefined && x.laps !== '' ? x.laps + ' laps' : '', x.best ? 'best ' + E.fmtTime(x.best) : '']
              .filter(Boolean)
              .join(', ')
          : x.best
            ? E.fmtTime(x.best)
            : '';
        return `${medal[pos - 1] || pos + '.'} ${x.driverName}${x.carName ? ' (' + x.carName + ')' : ''}${what ? ' · ' + what : ''}`;
      }),
      ...(fastest ? ['', `⏱ Fastest lap: ${fastName ? fastName + ', ' : ''}${E.fmtTime(fastest.time)}`] : [])
    ].join('\n');
  }
  const shareName = (session, ext) => `${session.setupName || 'Session'} ${dayOf(session.date)}.${ext}`.replace(/[\\/:*?"<>|]/g, '-');
  const api = {
    sessionHtml,
    sessionTable,
    sessionCsv,
    sessionText,
    shareName,
    heatSheetHtml,
    standingsHtml,
    standingsFileName,
    fileName,
    lapGroups,
    qrHtml,
    rulesHtml,
    CREDIT
  };
  root.Report = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
