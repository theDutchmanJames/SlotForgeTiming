// Builds the printable report for one session: page 1 = results, page 2 onwards = every lap time.
// Pure (it only returns HTML), so it can be tested without a screen; the app turns the HTML into a PDF.
(function (root) {
  const E = typeof module !== 'undefined' ? require('./engine.js') : root.RaceEngine;
  const RT = typeof module !== 'undefined' ? require('./richtext.js') : root.RichText;
  const HT = typeof module !== 'undefined' ? require('./heats.js') : root.Heats;
  const ST = typeof module !== 'undefined' ? require('./stats.js') : root.Stats;
  const IC = typeof module !== 'undefined' ? require('./icons.js') : root.Icons;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LABEL = { practice: 'Free practice', qualifying: 'Qualifying', race: 'Race by laps', timed: 'Timed race', heats: 'Heat-based race', tokens: 'Time Token Session' };
  const dateText = iso => (iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' }) : '');

  // laps of one session, grouped (one group, or one per heat), each as columns of lap times per driver
  function lapGroups(session, laps) {
    const heatNumbers = [...new Set(laps.map(l => l.heat || 0))].sort((a, b) => a - b);
    return heatNumbers.map(h => {
      const mine = laps.filter(l => (l.heat || 0) === h);
      const cols = session.standings.filter(s => mine.some(l => l.driverId === s.driverId))
        .map(s => ({ s, laps: mine.filter(l => l.driverId === s.driverId).sort((a, b) => a.lapNumber - b.lapNumber) }));
      return { heat: h, final: (mine.find(l => l.final) || {}).final || '', cols };
    }).filter(g => g.cols.length);
  }

  // What goes in the PDF. options (all optional, everything is in when it is left out): results (the table), heats (the summary of the heats and finals), laps (the page with every lap time),
  // columns (the keys of the columns of the table, as Stats.SESSION_COLUMNS names them; the default is the ones that are on until turned off).
  // tracks and cars (the lists from the database) give the length and scale for the speeds.
  const DEFAULT_OPTIONS = { results: true, heats: true, laps: true };
  function sessionHtml({ session, laps, tracks, cars, options }) {
    const opt = { ...DEFAULT_OPTIONS, ...(options || {}) };
    const pts = session.resultBy === 'points', isHeats = session.sessionType === 'heats';
    const res = isHeats && !!session.scoring && session.standings.some(x => x.score !== undefined); // a heat race with a result that is not just all heats added up
    const fin = isHeats && !!session.finals, finArg = { finalMode: fin ? session.finals.finalMode : 'places', byPoints: pts };
    const figs = ST.forSession(session, laps, tracks, cars), want = new Set(opt.columns || ST.SESSION_COLUMNS.filter(c => c.on).map(c => c.key));
    const cols = ST.sessionColumns(session, figs).filter(c => want.has(c.key));
    const cup = IC.trophy({ size: 14 }), hasDriver = cols.some(c => c.key === 'driver'); // (the winner's cup goes next to the name; without the Driver column next to the position)
    const cellOf = (key, x, i) => {
      switch (key) {
        case 'pos': return esc(x.pos) + (!hasDriver && ST.isWinner(session, x) ? ' ' + cup : '');
        case 'driver': return (ST.isWinner(session, x) ? cup + ' ' : '') + esc(x.driverName) + (x.dq ? ' (disqualified)' : x.retired ? ' (retired, out of fuel)' : '') + (ST.adjustedText(x) ? ` (adjusted: ${esc(ST.adjustedText(x))})` : '');
        case 'car': return esc(x.carName);
        case 'laps': return esc(x.laps);
        case 'points': return esc(x.points);
        case 'result': return esc(HT.scoreText(x, session.scoring, finArg));
        case 'final': return esc(HT.finalCell(x));
        case 'best': return esc(E.fmtTime(x.best));
        case 'total': return esc(E.fmtTime(x.total + (x.penalty || 0) + (x.adjMs || 0))) + (x.penalty ? ` (includes +${esc(E.fmtTime(x.penalty))} penalty, ${esc(x.penaltyPoints)} points)` : '');
        default: return esc(ST.text(key, figs[i]));
      }
    };
    const standings = !opt.results || !cols.length ? '' : `<table${cols.length > 8 ? ' class="wide"' : ''}><thead><tr>${cols.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>` +
      session.standings.map((x, i) => `<tr>${cols.map(c => `<td>${cellOf(c.key, x, i)}</td>`).join('')}</tr>`).join('') + '</tbody></table>' +
      (ST.notes(cols.map(c => c.key)).length ? `<p class="sub">${ST.notes(cols.map(c => c.key)).map(esc).join(' ')}</p>` : '') +
      (isHeats && session.scoring && HT.scoringText(session.scoring, pts) ? `<p class="sub">${esc(HT.scoringText(session.scoring, pts))}</p>` : '') + (fin ? `<p class="sub">${esc(HT.finalsSaid(session.finals))}</p>` : '');
    const heatSummary = !opt.heats || !session.heatResults ? '' : `<h2>${session.finals ? 'Heats and finals' : 'Heats'}</h2>` + session.heatResults.map(h =>
      `<p><b>${esc(HT.raceName(h))}</b>: ${h.rows.map(r => `${esc(r.pos)}. ${ST.isHeatWinner(session, r) ? cup + ' ' : ''}${esc(r.driverName)} (${esc(r.laps)} laps${pts ? ', ' + esc(r.points) + ' pts' + (r.bonus ? ' incl. ' + esc(r.bonus) + ' for the fastest lap' : '') : ''}${ST.adjustedText(r) ? ', adjusted: ' + esc(ST.adjustedText(r)) : ''})`).join(' &middot; ')}</p>`).join('');
    const groups = lapGroups(session, laps);
    const lapPages = groups.map(g => {
      const most = Math.max(...g.cols.map(c => c.laps.length));
      const rows = Array.from({ length: most }, (_, i) => `<tr><td>${i + 1}</td>${g.cols.map(c => {
        const l = c.laps[i]; if (!l) return '<td></td>';
        const bad = x => x.invalid || x.tooSlow, best = Math.min(...c.laps.filter(x => !bad(x)).map(x => x.time));
        const tm = esc(E.fmtTime(l.time));
        return `<td>${bad(l) ? `<s title="${l.invalid ? 'invalid lap' : 'too slow'}">${tm}</s>` : l.time === best ? `<b>${tm}</b>` : l.pit ? `<i title="pit stop">${tm}</i>` : tm}</td>`;
      }).join('')}</tr>`).join('');
      return `${isHeats ? `<h2>${esc(HT.raceName(g))}</h2>` : ''}<table class="laps"><thead><tr><th>Lap</th>${g.cols.map(c => `<th>${esc(c.s.driverName)}<br><span class="sub">${esc(c.s.carName)}</span></th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
    }).join('');
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(session.setupName)}</title><style>
      @page { size: A4; margin: 15mm; }
      body { font: 11pt/1.4 Arial, Helvetica, sans-serif; color: #111; margin: 0; }
      h1 { font-size: 22pt; margin: 0 0 4px; } h2 { font-size: 14pt; margin: 18px 0 6px; }
      .meta { color: #444; margin: 0 0 14px; } .sub { color: #666; font-weight: normal; font-size: 9pt; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 8px; } th, td { border-bottom: 1px solid #ccc; padding: 5px 8px; text-align: left; font-variant-numeric: tabular-nums; }
      th { background: #eee; } .laps td, .laps th { text-align: right; } .laps td:first-child, .laps th:first-child { text-align: left; }
      .wide th, .wide td { font-size: 9pt; padding: 4px 5px; }
      thead { display: table-header-group; } tr { page-break-inside: avoid; }
      .page2 { page-break-before: always; } .foot { color: #777; font-size: 9pt; margin-top: 16px; }
    </style></head><body>
      <h1>${esc(session.setupName)}</h1>
      <p class="meta">${esc(LABEL[session.sessionType] || '')} &middot; ${esc(session.trackName || '')} &middot; ${esc(dateText(session.date))}${session.endedBy ? ' &middot; ' + esc(session.endedBy) : ''}</p>
      ${standings ? '<h2>Results</h2>' + standings : ''}${heatSummary}
      ${opt.laps ? `<div class="page2"><h1>All lap times</h1><p class="meta">${esc(session.setupName)} &middot; ${esc(session.trackName || '')} &middot; ${esc(dateText(session.date))}. The fastest lap of each driver is in bold.${laps.some(l => l.pit) ? ' A lap with a pit stop is in italics.' : ''}</p>${lapPages || '<p>No laps were recorded.</p>'}
      <p class="foot">Made with SlotForge Timing</p></div>` : '<p class="foot">Made with SlotForge Timing</p>'}</body></html>`;
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
    'This App has been made by Claude and theDutchmanJames.',
    'For all Slotcar Enthusiasts and special thanks to:',
    'Bjorn F. - For being my best mate!',
    'RaceCoordinator, for the ideas, inspiration and their work on RCAI.',
    'Kevan @Slotracer, the first person to say something, even though it was just smileys..',
    'Dopamine @Slotforum, for his ideas on Audio Customization.',
    'LMP & Superslab @Slotforum, for their BoP System.',
    'Johnno @Slotracer, for the first constructive feedback'
  ];
  // The racing rules as a page to hand out: the club's own formatting and a clear title (no credit on it)
  function rulesHtml({ title, html }) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      @page { size: A4; margin: 18mm; }
      body { font: 12pt/1.5 Arial, Helvetica, sans-serif; color: #111; margin: 0; }
      h1.title { font-size: 26pt; margin: 0 0 2mm; padding-bottom: 3mm; border-bottom: 2px solid #111; }
      .body h1, .body h2, .body h3 { margin: 1em 0 .3em; page-break-after: avoid; } .body ul, .body ol { padding-left: 1.4em; } .body li, .body p { page-break-inside: avoid; }
    </style></head><body><h1 class="title">${esc(title)}</h1><div class="body">${RT.clean(html)}</div></body></html>`;
  }

  const fileName = session => `${session.setupName || 'Session'} ${(session.date || '').slice(0, 10)}.pdf`.replace(/[\\/:*?"<>|]/g, '-');
  const api = { sessionHtml, fileName, lapGroups, qrHtml, rulesHtml, CREDIT };
  root.Report = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
