// The cards of the Home tab (1.17.0, a grid of them since 1.25.0): the words and the markup of every card except Start a race (that one is part of landing.js, because it
// is the form of the page). Pure: a card is made from figures that landing.js worked out with homestats.js, so it can be tested without a screen.
// d = { fmtDate(iso), fmtShort(iso), trackName, rec, last, glance, recent, fastest, records, top, bests, rules, setupName, hasTrack, hasSetup, images }
// (1.28.0: mileage = [{ name, picture, laps, distance }] for Car Mileage; Notes needs nothing.)
// (1.34.0: service = [{ carId, name, picture, interval, since, left, over, due }], serviceTotal and serviceSet for Service Due; it needs no races, only cars.)
// (1.26.0: images = the pictures of the picture sets that the Weather and Tyres Available cards use: { weather, conditions, tyres }, each the images of a set or nothing.)
(function (root) {
  const G = typeof module !== 'undefined' ? require('./homegrid.js') : root.HomeGrid;
  const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // The pictures of the weather widgets (weatherwidgets.js) are used for the weather and the tyres: the drawn ones, or those of a picture set. Looked up when a card is made,
  // so a page that never shows these cards does not need that file.
  const wxw = () => (typeof module !== 'undefined' ? require('./weatherwidgets.js') : root.WxW), wx = () => (typeof module !== 'undefined' ? require('./weather.js') : root.Wx);
  const SAFE = /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([0-9 ,.%/]+\))$/i; // (a colour goes into a style: only plain colour text does)
  const tag = t => (t ? `<span class="hm-tag">${esc(t)}</span>` : '');
  const card = (cls, title, tagText, inner) => `<section class="card ${cls}"><h3>${esc(title)}${tag(tagText)}</h3>${inner}</section>`;
  const initials = name => String(name || '').trim().split(/\s+/).filter(Boolean).map(word => (word.match(/[\p{L}\p{N}]/u) || [''])[0]).join('').slice(0, 2).toUpperCase() || '•';

  // Nothing is raced yet: one friendly card instead of the cards that need races to show anything.
  const empty = () => `<section class="card hm-empty"><h3>Your racing shows up here</h3><p class="muted">After the first race that is saved, this place shows the record to beat on your track, the podium of the last race and your totals.</p></section>`;

  const record = d => {
    const rec = d.rec; if (!rec) return card('hm-rec', 'Record to beat', '', '<p class="muted">This race setup has no track yet.</p>');
    return `<section class="card hm-rec"><h3>Record to beat<span class="hm-tag">${esc(d.trackName)}</span></h3>${rec.record
      ? `<div class="hm-rec-main"><div class="hm-time">${esc(rec.record.text)}</div><span class="hm-rec-label">track record</span></div><div class="hm-rec-holder"><span class="hm-rec-avatar" aria-hidden="true">${esc(initials(rec.record.driver))}</span><div><strong>${esc(rec.record.driver)}${rec.record.car ? ' · ' + esc(rec.record.car) : ''}</strong><small>${esc([d.fmtDate(rec.record.date), rec.record.setupName].filter(Boolean).join(' · '))}</small></div></div>${rec.line ? `<p class="hm-rec-status"><i aria-hidden="true"></i>${esc(rec.line)}</p>` : ''}`
      : '<p class="muted">No lap has been saved on this track yet. The first lap sets the record.</p>'}</section>`;
  };
  const last = d => {
    const l = d.last; if (!l) return card('hm-last', 'Last race', '', '<p class="muted">No race has been saved yet.</p>');
    return `<section class="card hm-last"><h3>${esc(l.label)}<span class="hm-tag">${esc(d.fmtDate(l.date))}</span></h3>${l.podium.length
      ? `<ol class="hm-pod">${l.podium.map(p => `<li class="p${p.pos}"><span class="n">${p.pos}</span><strong>${esc(p.name)}</strong><small>${esc(p.detail)}</small></li>`).join('')}</ol>` : '<p class="muted">No car finished a lap.</p>'}
      <p class="hint2">${esc(l.setupName)}${l.trackName ? ' on ' + esc(l.trackName) : ''}${l.fastest ? ` · Fastest lap: ${esc(l.fastest.driver ? l.fastest.driver + ', ' : '')}${esc(l.fastest.text)}` : ''}</p></section>`;
  };
  const glance = d => {
    const g = d.glance;
    return `<section class="card hm-glance"><h3>At a glance</h3><div class="hm-tiles">
      <div class="hm-tile"><div class="v">${g.races}</div><div class="l">${g.races === 1 ? 'race' : 'races'} raced</div></div>
      <div class="hm-tile"><div class="v">${esc(g.laps.toLocaleString('en-US'))}</div><div class="l">${g.laps === 1 ? 'lap' : 'laps'} driven</div></div>
      <div class="hm-tile"><div class="v">${g.distance === null ? '–' : esc(d.fmtDist(g.distance))}</div><div class="l">distance</div></div>
      <div class="hm-tile"><div class="v">${g.wins ? esc(g.wins.name) : '–'}</div><div class="l">${g.wins ? `most wins (${g.wins.count})` : 'most wins'}</div></div></div></section>`;
  };

  const recent = d => card('hm-recent', 'Recent races', d.recent.length ? 'last ' + d.recent.length : '', d.recent.length
    ? `<ul class="hm-list">${d.recent.map(r => `<li><button type="button" class="hm-row" data-session="${esc(r.id)}" title="Open the results of this race"><span class="d">${esc(d.fmtShort(r.date))}</span><span class="n">${esc(r.name)}</span><span class="r">${esc(r.result)}</span></button></li>`).join('')}</ul>`
    : '<p class="muted">No race has been saved yet.</p>');

  const fastest = d => {
    const f = d.fastest, all = d.fastestScope === 'all', rows = f.tracks;
    const body = !rows.length ? `<p class="muted">${all ? 'No lap has been driven this week yet.' : `No lap has been driven on ${esc(d.trackName || 'this track')} this week yet.`}</p>`
      : rows.map(t => `${all ? `<h4 class="hm-h4">${esc(t.trackName)}</h4>` : ''}<ol class="hm-rank">${t.rows.map((r, i) => `<li><span class="n">${i + 1}</span><span class="w">${esc(r.driver)}</span><strong>${esc(r.text)}</strong></li>`).join('')}</ol>`).join('');
    return card('hm-fastest', 'Fastest laps this week', all ? 'all tracks' : d.trackName, body);
  };

  const records = d => card('hm-records', 'Records on all tracks', '', d.records.length
    ? d.records.map(r => `<div class="hm-recrow2"><span class="who"><strong>${esc(r.trackName)}</strong><small>${esc([r.driver, r.car, d.fmtDate(r.date)].filter(Boolean).join(' · '))}</small></span><b class="hm-time sm">${esc(r.text)}</b></div>`).join('')
    : '<p class="muted">No lap has been saved yet.</p>');

  const top = d => {
    const year = d.topPeriod !== 'all', list = d.top, max = list.length ? list[0].count : 1;
    return card('hm-top', 'Top drivers', year ? 'wins this year' : 'wins, all time', list.length
      ? list.map(w => `<div class="hm-bar"><span class="w">${esc(w.name)}</span><span class="b"><i style="width:${Math.max(4, Math.round(w.count / max * 100))}%"></i></span><b>${w.count}</b></div>`).join('')
      : `<p class="muted">${year ? 'Nobody has won a race this year yet.' : 'Nobody has won a race yet.'}</p>`);
  };

  const bests = d => card('hm-bests', 'Personal Bests for Drivers on the Grid', d.trackName, !d.hasTrack ? '<p class="muted">This race setup has no track yet.</p>'
    : !d.bests.length ? '<p class="muted">Choose the drivers for the lanes to see their personal bests here.</p>'
      : d.bests.map(b => `<div class="hm-kv"><span class="who"><i class="hm-dot" style="${SAFE.test(String(b.color).trim()) ? '--c:' + esc(String(b.color).trim()) : ''}"></i>${esc(b.name)}</span><strong${b.time === null ? ' class="muted"' : ''}>${esc(b.text)}</strong></div>`).join(''));

  const rules = d => card('hm-rules', 'Rules of this race', d.setupName, !d.hasSetup ? '<p class="muted">Create a race setup in the Race Setup tab to see its rules here.</p>'
    : d.rules.map(([k, v]) => `<div class="hm-kv"><span class="muted">${esc(k)}</span><strong>${esc(v)}</strong></div>`).join(''));

  const shortcuts = (d, board) => {
    const list = G.shortcutsOf(board);
    return card('hm-shortcuts', 'Shortcuts', '', list.length
      ? `<div class="hm-go2">${list.map(s => `<button type="button" class="btn" data-go="${esc(s.key)}">${esc(s.label)}</button>`).join('')}</div>`
      : '<p class="muted">No shortcut is switched on. Open Customize and tick the pages you want here.</p>');
  };

  // 1.26.0 Weather: the weather and the conditions of the track as they were typed in the settings of the card (nothing is read from a race)
  const weather = (d, board) => {
    const W = wxw(), X = wx(), o = k => G.optionOf(board, k), img = d.images || {}, state = o('state');
    const c = { units: o('units'), state, track: o('track'), air: o('air'), wind: o('wind'), dir: o('dir') }, tx = X.condText(c), line = o('line');
    const tiles = [[o('showTrack'), 'tracktemp', tx.track, 'Track'], [o('showAir'), 'airtemp', tx.air, 'Air'], [o('showWind'), 'windspeed', tx.wind, 'Wind'],
      [o('showDir'), 'winddir', o('showDegrees') ? `${tx.dir} ${tx.degrees}` : tx.dir, 'From']].filter(t => t[0])
      .map(([, kind, text, label]) => `<div class="hm-ctile">${W.icon('cond', kind, img.conditions, c.dir, false)}<div><b>${esc(text)}</b><small>${label}</small></div></div>`).join('');
    return card('hm-weather', 'Weather', '', `<div class="hm-sky">${W.icon('state', state, img.weather, 0, false)}<div><strong>${esc(X.stateName(state))}</strong>${line ? `<small>${esc(line)}</small>` : ''}</div></div>`
      + (tiles ? `<div class="hm-ctiles cd-${esc(o('layout'))}">${tiles}</div>` : ''));
  };

  // 1.26.0 Tyres Available: the tyres that are ticked, with the name that was given, and how many (when that is switched on), in a column or in a row
  const tyres = (d, board) => {
    const W = wxw(), list = G.tyresOf(board), count = G.optionOf(board, 'showCount'), img = d.images || {};
    return card('hm-tyrecard', 'Tyres Available', '', list.length
      ? `<ul class="hm-tyres hm-ty-${esc(G.optionOf(board, 'layout'))}">${list.map(t => `<li>${W.icon('tyre', t.code, img.tyres, 0, false)}<span class="n">${esc(t.name)}</span>${count ? `<strong class="c">× ${t.count}</strong>` : ''}</li>`).join('')}</ul>`
      : '<p class="muted">No tyre is ticked. Open Customize and tick the tyres you want here.</p>');
  };

  // 1.28.0 Notes: the words that were typed in the settings of the card, with the lines as they were typed (nothing is read from a race)
  const notes = (d, board) => {
    const o = k => G.optionOf(board, k), text = o('text'), title = o('showTitle') ? o('title') || 'Notes' : '';
    return `<section class="card hm-notes hm-n-${esc(o('size'))}">${title ? `<h3>${esc(title)}</h3>` : ''}${text ? `<div class="hm-ntext">${esc(text)}</div>` : '<p class="muted">No notes yet. Open Customize and type them here.</p>'}</section>`;
  };

  // 1.28.0 Car Mileage: the slotcars with the most laps (d.mileage, the cars that are shown), the laps and the distance, a bar and the picture of the car, as the settings of the card say
  const PIC = /^data:image\//i; // (only a picture that is in the file itself goes into the page)
  const mileage = (d, board) => {
    const o = k => G.optionOf(board, k), show = o('show'), list = d.mileage || [], year = o('period') === 'year', byDist = show === 'distance';
    const val = r => (byDist ? r.distance || 0 : r.laps), max = Math.max(1, ...list.map(val)), pics = o('pics') && list.some(r => PIC.test(String(r.picture || '')));
    const rows = list.map(r => {
      const laps = `${r.laps.toLocaleString('en-US')} ${r.laps === 1 ? 'lap' : 'laps'}`, dist = r.distance === null || r.distance === undefined ? null : d.fmtDist(r.distance);
      const v = show === 'laps' ? `<strong>${esc(laps)}</strong>` : byDist ? `<strong>${esc(dist === null ? '–' : dist)}</strong>` : `<strong>${esc(laps)}</strong>${dist === null ? '' : ` · <span class="muted">${esc(dist)}</span>`}`;
      return `<div class="hm-mrow">${pics ? (PIC.test(String(r.picture || '')) ? `<img class="hm-carpic" src="${esc(r.picture)}" alt="">` : '<span class="hm-carpic"></span>') : ''}<div class="mm"><div class="mt"><span class="mn">${esc(r.name)}</span><span class="mv">${v}</span></div>${o('bars') ? `<div class="hm-mbar"><i style="width:${Math.max(4, Math.round(val(r) / max * 100))}%"></i></div>` : ''}</div></div>`;
    }).join('');
    return card('hm-mileage', 'Car Mileage', year ? 'this year' : 'all time', rows || `<p class="muted">${year ? 'No lap has been driven with a car this year yet.' : 'No lap has been saved with a car yet.'}</p>`);
  };

  // 1.34.0 Service Due: the slotcars that need servicing, or soon will (d.service = [{ carId, name, picture, interval, since, left, over, due }], the cars that are shown, from CarStats.dueList;
  // d.serviceTotal = how many cars there are before the list was cut, d.serviceSet = how many cars have a service interval). With a bar or a picture a car is a row like Car Mileage has;
  // with neither it is one line with a dot. A click on a car opens its card (data-car).
  const lapsText = n => `${Number(n).toLocaleString('en-US')} ${Number(n) === 1 ? 'lap' : 'laps'}`;
  const service = (d, board) => {
    const o = k => G.optionOf(board, k), list = d.service || [], total = Math.max(list.length, Number(d.serviceTotal) || 0), dueOnly = o('show') === 'due';
    if (!list.length) {
      return card('hm-svc', 'Service Due', Number(d.serviceSet) > 0 ? 'all good' : '', `<p class="muted">${Number(d.serviceSet) > 0
        ? `No car needs servicing. A car shows here when ${dueOnly ? 'it has reached its service interval' : `it is within ${esc(o('within'))}% of its service interval, or past it`}.`
        : 'No slotcar has a service interval yet. Set one in Database > Slotcars, in the Statistics folder of a car.'}</p>`);
    }
    const rich = o('bars') || o('pics'), pics = o('pics') && list.some(r => PIC.test(String(r.picture || '')));
    const status = r => (r.due ? 'Service due' : `${lapsText(r.left)} to go`);
    const short = r => (r.due ? (r.over > 0 ? `${lapsText(r.over)} over` : 'due now') : `${lapsText(r.left)} to go`);
    const rows = list.map(r => {
      const cls = r.due ? 'due' : 'soon', go = `type="button" data-car="${esc(r.carId)}" title="Open the card of this car"`;
      if (!rich) return `<button class="hm-kv hm-carbtn" ${go}><span class="who"><i class="sv-dot ${cls}"></i>${esc(r.name)}</span><strong class="sv-st ${cls}">${esc(short(r))}</strong></button>`;
      const more = `${Number(r.since).toLocaleString('en-US')} of ${lapsText(r.interval)}${r.due ? (r.over > 0 ? ` · ${r.over.toLocaleString('en-US')} over` : ' · due now') : ''}`;
      return `<button class="hm-mrow hm-carbtn" ${go}>${pics ? (PIC.test(String(r.picture || '')) ? `<img class="hm-carpic" src="${esc(r.picture)}" alt="">` : '<span class="hm-carpic"></span>') : ''}<span class="mm"><span class="mt"><span class="mn">${esc(r.name)}</span><span class="mv"><strong class="sv-st ${cls}">${esc(status(r))}</strong><small>${esc(more)}</small></span></span>${o('bars') ? `<span class="hm-mbar sv-bar"><i class="${cls}" style="width:${Math.max(4, Math.min(100, Math.round(r.since / r.interval * 100)))}%"></i></span>` : ''}</span></button>`;
    }).join('');
    return card('hm-svc', 'Service Due', total > list.length ? `${list.length} of ${total} cars` : `${total} ${total === 1 ? 'car' : 'cars'}`, rows);
  };

  // The card for a key, from the figures d (and the board, for the options of the card). Start a race is not made here.
  function html(key, d, board) {
    switch (key) {
      case 'record': return record(d); case 'last': return last(d); case 'glance': return glance(d); case 'recent': return recent(d); case 'fastest': return fastest(d);
      case 'records': return records(d); case 'top': return top(d); case 'bests': return bests(d); case 'rules': return rules(d); case 'shortcuts': return shortcuts(d, board);
      case 'weather': return weather(d, board); case 'tyres': return tyres(d, board); case 'notes': return notes(d, board); case 'mileage': return mileage(d, board); case 'service': return service(d, board);
      default: return '';
    }
  }
  // Cards that have nothing to show before a race is saved: they give way to one friendly card.
  const NEEDS_RACES = ['record', 'last', 'glance', 'recent', 'fastest', 'records', 'top', 'bests', 'mileage'];

  const api = { html, empty, NEEDS_RACES, esc };
  root.HomeCards = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
