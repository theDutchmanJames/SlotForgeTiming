// (2.4.0, SlotForgeRestyle.md "Commentary Booth") the audio set editor as a booth: the voice first (with the speaker it plays on and a sentence to hear),
// the presets as cards with how many calls each turns on and which one the set is closest to, how every driver's name is said (written as it sounds, or a
// recording), and a sample race that plays the set from the start to the winner.
// Pure: words, numbers and markup only, so it can be tested without a screen. audiostudio.js and audioedit.js draw it and wire it; sound.js and
// announcer.js say the names.
(function (root) {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const PRESETS = [
    ['Essential', 'Only the start, the flags and the finish. Quiet for practice nights.'],
    ['Club', 'A club night: positions, records, pit stops and the race systems you use.'],
    ['Broadcast', 'Everything, like TV. Calls wait their turn so it never talks over itself.']
  ];
  // what every preset would do to this set: how many calls it has on, how many switch on or off, and which preset the set is closest to
  // profile(set, name) is Sound.profile; ids: the ids of the calls
  function presets(set, profile, ids) {
    const onNow = id => (set.calls[id] || {}).on !== false;
    const list = PRESETS.map(([name, text]) => {
      const p = profile(set, name),
        on = ids.filter(id => (p.calls[id] || {}).on !== false);
      const comeOn = ids.filter(id => (p.calls[id] || {}).on !== false && !onNow(id)).length,
        goOff = ids.filter(id => (p.calls[id] || {}).on === false && onNow(id)).length;
      return { name, text, on: on.length, comeOn, goOff, differ: comeOn + goOff };
    });
    const closest = list.reduce((a, b) => (b.differ < a.differ ? b : a));
    return { list, closest: closest.name, now: ids.filter(onNow).length, total: ids.length };
  }
  function presetCardsHtml(P) {
    return `<div class="ab-presets">${P.list
      .map(p => {
        const mine = p.name === P.closest,
          fill = Math.round((20 * p.on) / Math.max(1, P.total));
        return `<article class="ab-pre${mine ? ' on' : ''}"><b>${esc(p.name)}</b><span class="n">${p.on}<small> calls</small></span><p>${esc(p.text)}</p><div class="ab-pbar" aria-hidden="true">${Array.from({ length: 20 }, (_, i) => `<span class="${i < fill ? 'on' : ''}"></span>`).join('')}</div><div class="ft"><span>${
          !p.differ
            ? 'This is your set'
            : mine
              ? `Closest to your set · ${p.differ} differ`
              : [p.comeOn ? `${p.comeOn} come on` : '', p.goOff ? `${p.goOff} go off` : ''].filter(Boolean).join(' · ')
        }</span>${p.differ ? `<button type="button" class="btn sm" data-audio-preset="${esc(p.name)}">${mine ? `See the ${p.differ}` : `Use ${esc(p.name)}`}</button>` : ''}</div></article>`;
      })
      .join('')}</div>`;
  }

  // ---- how a driver's name is said ----
  // names: the set's { driverId: { say, file, fileName, name } }; the name as the voice says it, or a mark ⟦id⟧ where the recording plays
  const MARK = /⟦([^⟧]+)⟧/g;
  function spoken(names, id, name) {
    const n = names && id !== undefined && id !== null ? names[id] : null;
    if (n && n.file) return '⟦' + id + '⟧';
    return (n && String(n.say || '').trim()) || name || '';
  }
  // a sentence in pieces: [{ text }] and [{ file, id }] where a recorded name is said (a recording that is gone says the written name)
  function pieces(text, names) {
    const out = [];
    let last = 0;
    const s = String(text || '');
    s.replace(MARK, (m, id, at) => {
      if (at > last) out.push({ text: s.slice(last, at) });
      const n = (names && names[id]) || {};
      out.push(n.file ? { file: n.file, id } : { text: n.say || n.name || '' });
      last = at + m.length;
      return m;
    });
    if (last < s.length) out.push({ text: s.slice(last) });
    return out.filter(p => p.file || String(p.text).trim());
  }
  const plainText = (text, names) =>
    String(text || '').replace(MARK, (m, id) => {
      const n = (names && names[id]) || {};
      return n.say || n.name || '';
    });
  function namesHtml(drivers, names, o = {}) {
    if (!drivers.length)
      return '<div class="gx-empty small"><div><h3>No drivers yet</h3><p>Add drivers in the Database; then you can set how each name is said.</p></div></div>';
    return `<div class="ab-names" role="table"><div class="ab-nr h" role="row"><span></span><span>Driver</span><span>Callsign</span><span>Said as</span><span></span><span>Recording</span></div>${drivers
      .map(dr => {
        const n = (names && names[dr.id]) || {};
        return `<div class="ab-nr" role="row" data-name-row="${esc(dr.id)}">${o.helmet ? o.helmet(dr) : '<span></span>'}<b>${esc(dr.name || 'Driver')}</b><span class="cs">${esc(dr.callsign || '')}</span><input type="text" data-name-say="${esc(dr.id)}" value="${esc(n.say || '')}" placeholder="as written: ${esc(dr.name || '')}" maxlength="60" aria-label="How ${esc(dr.name || 'this driver')} is said"><button type="button" class="ab-pl" data-name-play="${esc(dr.id)}" title="Hear it" aria-label="Hear ${esc(dr.name || 'this driver')}">▶</button><span class="ab-rec">${
          n.file
            ? `<span class="has" title="${esc(n.fileName || 'Recording')}">✓ Recorded</span><button type="button" class="btn sm ghost" data-name-clear="${esc(dr.id)}">Remove</button>`
            : `<button type="button" class="btn sm" data-name-record="${esc(dr.id)}"><i aria-hidden="true">●</i>Record</button><label class="btn sm ghost">File…<input type="file" accept="audio/*" data-name-file="${esc(dr.id)}" hidden></label>`
        }</span></div>`;
      })
      .join('')}</div>`;
  }

  // ---- a sample race: the set from the start to the winner, with four drivers ----
  // drivers: [{ id, name }]; returns [{ at (seconds), id (call), title, vars }]
  function sampleRace(drivers, o = {}) {
    const d = drivers.slice(0, 4),
      nm = i => (d[i] ? spoken(o.names, d[i].id, d[i].name) : ['Alex', 'Sam', 'Kim', 'Jo'][i]);
    const track = o.track || 'Club Oval';
    return [
      { at: 0, id: 'prerace', title: 'Before the start', vars: { track } },
      { at: 4, id: 'countdown5', title: 'Start lights', vars: {} },
      { at: 5, id: 'countdown4', title: '', vars: {} },
      { at: 6, id: 'countdown3', title: '', vars: {} },
      { at: 7, id: 'countdown2', title: '', vars: {} },
      { at: 8, id: 'countdown1', title: '', vars: {} },
      { at: 9, id: 'lightsout', title: 'Lights out', vars: {} },
      { at: 21, id: 'newleader', title: 'New leader', vars: { driver: nm(0), name: nm(0), leader: nm(0), lap: '3' } },
      { at: 33, id: 'fastestlap', title: 'Fastest lap', vars: { driver: nm(1), name: nm(1), time: '5.130', laptime: '5.130', lap: '6' } },
      { at: 41, id: 'yellowflag', title: 'Yellow flag', vars: { driver: nm(2), name: nm(2) } },
      { at: 52, id: 'lastlap', title: 'Last lap', vars: { driver: nm(0), name: nm(0), leader: nm(0) } },
      { at: 58, id: 'winner', title: 'Winner', vars: { driver: nm(0), name: nm(0), leader: nm(0), track } }
    ];
  }
  function sampleHtml(steps, now, said, o = {}) {
    const shown = steps.filter(s => s.title);
    return `<div class="ab-tl" role="list">${shown
      .map(s => {
        const st = said[s.id] === 'now' ? 'now' : said[s.id] ? 'done' : s.off ? 'off' : '';
        return `<div class="ab-tr ${st}" role="listitem"><span class="t">${String(Math.floor(s.at / 60))}:${String(s.at % 60).padStart(2, '0')}</span><span class="what">${esc(s.title)}</span><span>${s.text ? `“${esc(s.text)}”` : s.off ? '<i class="muted">off in this set</i>' : ''}</span><span class="st">${st === 'done' ? 'said' : st === 'now' ? '● speaking' : st === 'off' ? 'skipped' : 'next'}</span></div>`;
      })
      .join('')}</div>${o.foot || ''}`;
  }

  const api = { PRESETS, presets, presetCardsHtml, spoken, pieces, plainText, namesHtml, sampleRace, sampleHtml, MARK };
  root.AudioBooth = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
