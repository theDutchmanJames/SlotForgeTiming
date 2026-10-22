// The form of a race setup with a rail (1.71.0): a header (the picture of the kind, the name, the pills, "Ready to race"), a rail on the left with a row for every section (its name, a short
// note and a dot), the sections themselves as folding cards, and a bar at the bottom with Cancel and Save. This file makes the HTML of that frame and draws the notes and the dots into it
// (what the notes say is worked out in setupwords.js, rail()). Pure functions, no storage, so they can be tested without a screen. The settings in the sections are not drawn here: the form
// passes them in as HTML, and they are read and saved as before.
// The ids that the form uses: rs-rail-<section> (the row of the rail), rs-note-<section> (its note), rs-dot-<section> (its dot), rs-state-<section> (the dot in words, for a screen reader),
// rs-row-<section> (the note on the row of a closed section), rs-used (the box Used by), rstile, rspills and rsready (the header), rssay (the sentence "In plain words"), err, cancel.
(function (root) {
  const esc = s => String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const ico = (o, name) => (o && typeof o.icon === 'function' ? o.icon(name) : '');
  // what a dot says: the class that colours it, and the words for a hover and for a screen reader
  const STATES = { ok: ['ok', 'Filled in or changed'], todo: ['todo', 'Something is missing'], plain: ['off', 'Nothing changed from the standard'] };
  const stateOf = s => STATES[s] || STATES.plain;

  // a section: a card that folds. sec: { id, title, ask (what it answers, shown while it is open), icon, open, body (HTML) }
  const section = (sec, o) => `<details class="fgroup rssec" data-fg="${esc(sec.id)}"${sec.open ? ' open' : ''}><summary><span class="rsic">${ico(o, sec.icon)}</span><span class="rssx"><strong>${esc(sec.title)}</strong>`
    + `<span class="muted rsq">${esc(sec.ask)}</span><span class="muted rsrow" id="rs-row-${esc(sec.id)}"></span></span></summary>${sec.body}${sec.live ? `<div class="rsnote" id="rs-live-${esc(sec.id)}" role="status" hidden></div>` : ''}</details>`;
  // a part inside a section (the parts of Advanced): a small heading, what it is for, and its settings
  const sub = (id, title, note, fields) => `<section class="rssub" data-fg="${esc(id)}"><h4 class="rssubt">${esc(title)}</h4>${note ? `<p class="muted hint rssubn">${esc(note)}</p>` : ''}<div class="fgrid">${fields}</div></section>`;
  const grid = fields => `<div class="fgrid">${fields}</div>`;
  // a row of the rail
  const item = (sec, o) => `<button type="button" class="rsri" id="rs-rail-${esc(sec.id)}" data-rail="${esc(sec.id)}"><span class="rsic">${ico(o, sec.icon)}</span>`
    + `<span class="rsrt"><b>${esc(sec.title)}</b><small id="rs-note-${esc(sec.id)}"></small></span><i class="rsdot off" id="rs-dot-${esc(sec.id)}" aria-hidden="true"></i><span class="rssr" id="rs-state-${esc(sec.id)}"></span></button>`;
  // the box "Used by": the championships that drive this race setup, or the race setups that choose this system (1.73.0). names: a list of names, or null when it does not apply (a setup that is new, or the
  // list is not known). o (all of it may be left out): { usedNone: what it says when nothing uses it, usedIcon: the picture before every name, icon }
  const used = (names, o) => {
    if (!Array.isArray(names)) return '';
    const one = n => `<span class="rsun">${o && o.usedIcon ? `<span class="rsunic">${ico(o, o.usedIcon)}</span>` : ''}${esc(n)}</span>`;
    return `<div class="rsused" id="rs-used"><span class="rsrl">Used by</span>${names.length ? names.slice(0, 4).map(one).join('') + (names.length > 4 ? `<span class="muted">and ${names.length - 4} more</span>` : '') : `<span class="muted">${esc((o && o.usedNone) || 'No championship uses it yet')}</span>`}</div>`;
  };

  // The whole form. o: { eyebrow (Edit race setup), tile (the picture of the kind, as HTML), name (the field of the name, as HTML), sections: [{ id, title, ask, icon, open, optional, body }],
  // icon (name -> picture), used (names or null), say (the box In plain words, as HTML), cls (the classes of the form), error (the text of a problem),
  // and the words of the frame (1.73.0, so a system can have its own): navLabel (what a screen reader hears for the rail), caption (the small heading of the rail), save (the text of the Save button),
  // usedNone and usedIcon (see used) }
  function shell(o) {
    const main = o.sections.filter(s => !s.optional), extra = o.sections.filter(s => s.optional);
    return `<form id="frm" class="rsform${o.cls ? ' ' + esc(o.cls) : ''}">`
      + `<header class="rshd"><span class="rstile" id="rstile">${o.tile || ''}</span><div class="rstitle"><h3 class="rseye" id="rshead">${esc(o.eyebrow)}</h3>${o.name}<div class="rspills" id="rspills"></div></div><span class="rsready" id="rsready"></span></header>`
      + `<div class="rsbody"><nav class="rsrail" aria-label="${esc(o.navLabel || 'The sections of this race setup')}"><p class="rsrl">${esc(o.caption || 'This setup')}</p>${main.map(s => item(s, o)).join('')}`
      + (extra.length ? `<p class="rsrl rsrl2" id="rs-optional">Only if you need it</p>${extra.map(s => item(s, o)).join('')}` : '') + `${used(o.used, o)}</nav>`
      + `<div class="rsmain"><div class="rssay" id="rssay" aria-live="polite">${o.say || ''}</div>${o.sections.map(s => section(s, o)).join('')}</div></div>`
      + `<footer class="rsfoot"><p class="error" id="err" role="alert"></p><span class="muted rsdef">Everything else keeps its default.</span><button class="btn" type="button" id="cancel">Cancel</button><button class="btn primary" type="submit">${esc(o.save || 'Save race setup')}</button></footer></form>`;
  }

  // a number stays with its short unit on a narrow row of the rail ("5 s", "10 L", "25 %" are never split over two lines)
  const glue = t => String(t === undefined || t === null ? '' : t).replace(/(\d) (s|L|%)(?![\w])/g, '$1\u00a0$2');
  // Draw the notes and the dots. byId: id -> element. info: { section: { rail, row, state } } (setupwords.js, rail()); visible: { section: true | false } (a section with nothing to show now is not shown, also not in the rail);
  // current: the section that the rail points at. The elements that are not there are skipped (a form that has no rail).
  function sync(byId, info, visible, current) {
    Object.keys(info || {}).forEach(id => {
      const i = info[id], st = stateOf(i.state), shown = !visible || visible[id] !== false;
      const set = (key, fn) => { const el = byId(key + id); if (el) fn(el); };
      set('rs-note-', el => { el.textContent = glue(i.rail); });
      set('rs-row-', el => { el.textContent = i.row; });
      set('rs-dot-', el => { el.className = 'rsdot ' + st[0]; el.title = st[1]; });
      set('rs-state-', el => { el.textContent = st[1]; });
      set('rs-rail-', el => {
        el.hidden = !shown;
        if (el.classList && typeof el.classList.toggle === 'function') el.classList.toggle('on', id === current);
        if (typeof el.setAttribute === 'function') { if (id === current) el.setAttribute('aria-current', 'true'); else if (typeof el.removeAttribute === 'function') el.removeAttribute('aria-current'); }
      });
    });
    const opt = byId('rs-optional'); if (opt && info && info.advanced) opt.hidden = !(!visible || visible.advanced !== false);
  }

  // The notes under the settings of a section that has a place for one (live: true, see section): drawn again as the form changes. info: the sections of the rail (setupwords.js, systemwords.js),
  // notes: { section: { tone ('info'), parts: [{ t, b }] } }; a section without a note now hides its place. icon: name -> picture.
  function live(byId, info, notes, icon) {
    Object.keys(info || {}).forEach(id => {
      const el = byId('rs-live-' + id); if (!el) return;
      const n = notes && notes[id];
      el.hidden = !n; el.className = 'rsnote' + (n && n.tone ? ' ' + n.tone : '');
      el.innerHTML = n ? `<span class="rsnic">${typeof icon === 'function' ? icon(n.tone === 'warn' ? 'alert' : 'info') : ''}</span><span>${n.parts.map(p => (p.b ? `<b>${esc(p.t)}</b>` : esc(p.t))).join('')}</span>` : '';
    });
  }
  // The bar of the levels of a damage system (systemwords.js, strip): a part for every level, as wide as its stretch of damage points, with the numbers under it. d: the strip, or null (nothing to show).
  // The parts are coloured from the colour of the form, a little stronger for every level.
  function strip(d) {
    if (!d || !Array.isArray(d.parts) || !d.parts.length) return '';
    const bg = p => (p.kind === 'none' ? 'var(--line)' : `color-mix(in srgb,var(--accent) ${Math.round(14 + 46 * (p.step - 1) / Math.max(1, p.of - 2))}%,var(--panel))`);
    return `<div class="rsstrip" role="img" aria-label="${esc(d.text)}"><div class="rsbar">${d.parts.map(p => `<span class="rsseg" style="left:${p.left}%;width:${p.width}%;background:${bg(p)}" title="${esc(p.name)}">${esc(p.name)}</span>`).join('')}</div>`
      + `<div class="rsticks" aria-hidden="true">${d.ticks.filter(t => t.show).map(t => `<span style="${t.at > 60 && String(t.label).length > 4 ? 'right:0' : `left:${t.at}%`}">${esc(t.label)}</span>`).join('')}</div></div>`;
  }

  const api = { section, sub, grid, item, used, shell, sync, live, strip, stateOf, STATES };
  root.RailForm = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
