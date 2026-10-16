// The cards of the Home tab (1.17.0, a grid of them since 1.25.0): the words and the markup of every card except Start a race (that one is part of landing.js, because it
// is the form of the page). Pure: a card is made from figures that landing.js worked out with homestats.js, so it can be tested without a screen.
// d = { fmtDate(iso), fmtShort(iso), trackName, rec, last, glance, recent, fastest, records, top, bests, rules, setupName, hasTrack, hasSetup }
(function (root) {
  const G = typeof module !== 'undefined' ? require('./homegrid.js') : root.HomeGrid;
  const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SAFE = /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([0-9 ,.%/]+\))$/i; // (a colour goes into a style: only plain colour text does)
  const tag = t => (t ? `<span class="hm-tag">${esc(t)}</span>` : '');
  const card = (cls, title, tagText, inner) => `<section class="card ${cls}"><h3>${esc(title)}${tag(tagText)}</h3>${inner}</section>`;

  // Nothing is raced yet: one friendly card instead of the cards that need races to show anything.
  const empty = () => `<section class="card hm-empty"><h3>Your racing shows up here</h3><p class="muted">After the first race that is saved, this place shows the record to beat on your track, the podium of the last race and your totals.</p></section>`;

  const record = d => {
    const rec = d.rec; if (!rec) return card('hm-rec', 'Record to beat', '', '<p class="muted">This race setup has no track yet.</p>');
    return `<section class="card hm-rec"><h3>Record to beat<span class="hm-tag">${esc(d.trackName)}</span></h3>${rec.record
      ? `<div class="hm-recrow"><div class="hm-time">${esc(rec.record.text)}</div><div><strong>${esc(rec.record.driver)}</strong>${rec.record.car ? ' · ' + esc(rec.record.car) : ''}<small>${esc([d.fmtDate(rec.record.date), rec.record.setupName].filter(Boolean).join(' · '))}</small></div></div>${rec.line ? `<p class="hint2">${esc(rec.line)}</p>` : ''}`
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
      <div class="hm-tile"><div class="v">${esc(g.laps.toLocaleString())}</div><div class="l">${g.laps === 1 ? 'lap' : 'laps'} driven</div></div>
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

  const bests = d => card('hm-bests', 'Personal bests of the drivers on the grid', d.trackName, !d.hasTrack ? '<p class="muted">This race setup has no track yet.</p>'
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

  // The card for a key, from the figures d (and the board, for the options of the card). Start a race is not made here.
  function html(key, d, board) {
    switch (key) {
      case 'record': return record(d); case 'last': return last(d); case 'glance': return glance(d); case 'recent': return recent(d); case 'fastest': return fastest(d);
      case 'records': return records(d); case 'top': return top(d); case 'bests': return bests(d); case 'rules': return rules(d); case 'shortcuts': return shortcuts(d, board);
      default: return '';
    }
  }
  // Cards that have nothing to show before a race is saved: they give way to one friendly card.
  const NEEDS_RACES = ['record', 'last', 'glance', 'recent', 'fastest', 'records', 'top', 'bests'];

  const api = { html, empty, NEEDS_RACES, esc };
  root.HomeCards = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
