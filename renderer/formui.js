// The controls of a form that are made of buttons (1.70.0): a switch for a yes or no question, a row of buttons for a short choice (segmented), cards for a choice that needs a line of
// explaining, a row of boxes for a list of numbers, and the picker for the kind of a race setup (see setupwords.js). Pure functions that make HTML, so they can be tested without a screen.
// Every control is only a face for a setting that is stored as before: the setting stays in the form as a hidden field (a select, or a text), the buttons change its value, and the form
// reads, shows and saves that one value. So the stored values of a setting do not change and an old setting opens as it was. A setting says which control it has with `ui`:
//   'switch' (+ `on`: the stored value of On, the other option is Off)   'seg' / 'cards' (+ `offer`: the values that are offered, in this order; `full`: use the whole width)
//   'boxes' (a list of numbers, 1st, 2nd, 3rd and so on)   'kind' (the picker of a race setup)
// The text of a switch is the label of the setting. A card has a line under its name: the third part of its option ([value, name, line]).
(function (root) {
  const esc = s => String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const nth = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10 > 3 ? 0 : n % 10]}`; // 1st, 2nd, 3rd, 4th ... 11th, 12th, 21st
  const MAX_BOXES = 12; // the boxes of a list of numbers: how many positions a person can add (a list that has more is shown whole)

  // the setting itself, hidden: the form reads it as it reads any select
  const hiddenSelect = (f, v) => `<select id="f-${esc(f.id)}" hidden tabindex="-1" aria-hidden="true">${f.options.map(o => `<option value="${esc(o[0])}"${o[0] === v ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
  // the options that are offered as buttons: all of them, or the ones the setting lists (a stored value that is not offered stays in the hidden select)
  const offered = f => (Array.isArray(f.offer) ? f.offer.map(k => f.options.find(o => o[0] === k)).filter(Boolean) : f.options);
  const hint = (f, text) => (text ? `<span class="muted hint" id="hn-${esc(f.id)}">${esc(text)}</span>` : '');
  const wrap = (f, cls, inner) => `<div class="field${f.full || cls.includes('full') ? ' full' : ''} fu ${cls}" data-key="${esc(f.id)}">${inner}</div>`;
  const question = (f, label) => `<span class="fu-q" id="ql-${esc(f.id)}">${esc(label)}${f.optional ? ' <span class="muted">(optional)</span>' : ''}</span>`;

  // a row of buttons, one of them chosen
  function seg(f, v, ctx) {
    return wrap(f, 'fu-segfield', `${question(f, ctx.label)}<div class="fu-seg" role="group" aria-labelledby="ql-${esc(f.id)}" data-ctl="${esc(f.id)}">`
      + offered(f).map(o => `<button type="button" class="fu-b${o[0] === v ? ' on' : ''}" aria-pressed="${o[0] === v}" data-pick="${esc(f.id)}" data-val="${esc(o[0])}">${esc(o[1])}</button>`).join('')
      + `</div>${hiddenSelect(f, v)}${hint(f, ctx.hint)}`);
  }
  // cards: a name and a line, one of them chosen
  function cards(f, v, ctx) {
    const icon = k => (ctx.icon && f.icons && f.icons[k] ? `<span class="fu-ci">${ctx.icon(f.icons[k])}</span>` : '');
    return wrap(f, 'fu-cardfield full', `${question(f, ctx.label)}<div class="fu-cards" role="group" aria-labelledby="ql-${esc(f.id)}" data-ctl="${esc(f.id)}">`
      + offered(f).map(o => `<button type="button" class="fu-card${o[0] === v ? ' on' : ''}" aria-pressed="${o[0] === v}" data-pick="${esc(f.id)}" data-val="${esc(o[0])}"><span class="fu-ct">${icon(o[0])}<b>${esc(o[1])}</b></span>${o[2] ? `<span class="fu-cd">${esc(o[2])}</span>` : ''}${ctx.icon ? `<span class="fu-ck" aria-hidden="true">${ctx.icon('check')}</span>` : ''}</button>`).join('')
      + `</div>${hiddenSelect(f, v)}${hint(f, ctx.hint)}`);
  }
  // a switch: On stores `on`, Off stores the other option
  const offOf = f => (f.options.find(o => o[0] !== f.on) || [''])[0];
  function switchField(f, v, ctx) {
    const on = v === f.on;
    return wrap(f, 'fu-switchfield full', `<button type="button" role="switch" class="fu-sw${on ? ' on' : ''}" aria-checked="${on}" aria-labelledby="ql-${esc(f.id)}"${ctx.hint ? ` aria-describedby="hn-${esc(f.id)}"` : ''} data-pick="${esc(f.id)}" data-on="${esc(f.on)}" data-off="${esc(offOf(f))}">`
      + `<span class="fu-tg" aria-hidden="true"></span><span class="fu-swt"><b id="ql-${esc(f.id)}">${esc(ctx.label)}</b>${hint(f, ctx.hint)}</span></button>${hiddenSelect(f, v)}`);
  }
  // the numbers of a list as text ("10, 8, 6") -> the numbers as text, in order (a comma or a space or a semicolon between them)
  const listOf = text => (root.ListNum ? root.ListNum.items(text) : String(text === undefined || text === null ? '' : text).split(/[\s;,]+/).filter(Boolean));
  const boxRows = (id, list) => list.map((x, i) => `<label class="fu-box"><small>${nth(i + 1)}</small><input type="number" step="any" min="0" data-pbf="${esc(id)}" data-pb="${i}" value="${esc(x)}" aria-label="Points for ${nth(i + 1)} place"></label>`).join('');
  // a list of numbers in boxes: the list is kept in the hidden text field, as it always was ("10, 8, 6, 5")
  function boxes(f, v, ctx) {
    const list = listOf(v);
    return wrap(f, 'fu-boxfield full', `${question(f, ctx.label)}<div class="fu-boxes" role="group" aria-labelledby="ql-${esc(f.id)}"><span class="fu-boxlist" id="pb-${esc(f.id)}">${boxRows(f.id, list)}</span>`
      + `<button type="button" class="btn small" id="pb-add-${esc(f.id)}" data-pbadd="${esc(f.id)}" aria-label="Add a place"${list.length >= MAX_BOXES ? ' disabled' : ''}>+</button>`
      + `<button type="button" class="btn small" id="pb-drop-${esc(f.id)}" data-pbdrop="${esc(f.id)}" aria-label="Take the last place away"${list.length <= 1 ? ' disabled' : ''}>&minus;</button></div>`
      + `<input id="f-${esc(f.id)}" type="text" hidden tabindex="-1" aria-hidden="true" value="${esc(v)}">${hint(f, ctx.hint)}`);
  }
  // the picker of a race setup: what kind of session, one race or heats, and do the teams swap drivers. p: { kinds, formats, swaps: [title, line] } (setupwords.js); now: the answers now
  function kind(f, v, ctx) {
    const p = ctx.picker, now = ctx.parts, ic = k => (ctx.icon && p.icons && p.icons[k] ? `<span class="fu-ci">${ctx.icon(p.icons[k])}</span>` : '');
    const card = (attr, id, name, line, on) => `<button type="button" class="fu-card${on ? ' on' : ''}" aria-pressed="${on}" ${attr}="${esc(id)}"><span class="fu-ct">${ic(id)}<b>${esc(name)}</b></span><span class="fu-cd">${esc(line)}</span>${ctx.icon ? `<span class="fu-ck" aria-hidden="true">${ctx.icon('check')}</span>` : ''}</button>`;
    return wrap(f, 'fu-kindfield full', `${question(f, ctx.label)}<div class="fu-cards fu-c4" role="group" aria-labelledby="ql-${esc(f.id)}" data-ctl="kind">${p.kinds.map(k => card('data-kind', k[0], k[1], k[2], now.kind === k[0])).join('')}</div>${hint(f, ctx.hint)}`
      + `<div class="fu-race" id="fu-race"${now.kind === 'race' ? '' : ' hidden'}><span class="fu-q" id="ql-format">Format <small class="muted">Races only</small></span><div class="fu-cards fu-c2" role="group" aria-labelledby="ql-format" data-ctl="format">${p.formats.map(k => card('data-format', k[0], k[1], k[2], now.format === k[0])).join('')}</div>`
      + `<button type="button" role="switch" class="fu-sw${now.swaps ? ' on' : ''}" aria-checked="${now.swaps}" aria-labelledby="ql-swaps" aria-describedby="hn-swaps" data-swaps="1"><span class="fu-tg" aria-hidden="true"></span><span class="fu-swt"><b id="ql-swaps">${esc(p.swaps[0])}</b><span class="muted hint" id="hn-swaps">${esc(p.swaps[1])}</span></span></button></div>${hiddenSelect(f, v)}`);
  }

  const CONTROLS = { seg, cards, switch: switchField, boxes, kind };
  const has = ui => Object.prototype.hasOwnProperty.call(CONTROLS, ui);
  // the whole field: f the setting (with id), v its value, ctx { label, hint, icon(name) -> svg text, picker, parts }
  // a select that has no value (a setting from before the setting existed) holds its first option, as the form always did: the buttons show that one
  const norm = (f, v) => (Array.isArray(f.options) && !f.options.some(o => o[0] === v) ? f.options[0][0] : v);
  const field = (f, v, ctx) => CONTROLS[f.ui](f, f.ui === 'boxes' ? v : norm(f, v), ctx || {});

  // ---- after a change: the buttons show the value that the form holds ----
  const setOn = (b, on, attr) => { b.classList.toggle('on', on); b.setAttribute(attr || 'aria-pressed', String(on)); }; // (a button that is pressed, or a switch that is checked)
  // a seg, cards or a switch of the setting `key`, now holding `v`
  function sync(rootEl, f, v) {
    if (!rootEl || typeof rootEl.querySelectorAll !== 'function') return;
    if (f.ui === 'switch') { Array.from(rootEl.querySelectorAll(`[data-pick="${f.id}"]`)).forEach(b => setOn(b, v === f.on, 'aria-checked')); return; }
    if (f.ui === 'seg' || f.ui === 'cards') Array.from(rootEl.querySelectorAll(`[data-pick="${f.id}"]`)).forEach(b => setOn(b, (b.dataset || {}).val === v));
  }
  // the picker: now = { kind, format, swaps }
  function syncKind(rootEl, byId, now) {
    if (!rootEl || typeof rootEl.querySelectorAll !== 'function') return;
    Array.from(rootEl.querySelectorAll('[data-kind]')).forEach(b => setOn(b, (b.dataset || {}).kind === now.kind));
    Array.from(rootEl.querySelectorAll('[data-format]')).forEach(b => setOn(b, (b.dataset || {}).format === now.format));
    Array.from(rootEl.querySelectorAll('[data-swaps]')).forEach(b => setOn(b, !!now.swaps, 'aria-checked'));
    const race = byId('fu-race'); if (race) race.hidden = now.kind !== 'race';
  }
  // the boxes of a list: the numbers of a list as text, the list as text again, the boxes drawn again after a place is added or taken away
  const joinList = list => list.join(', ');
  const addPlace = list => { const last = Number(String(list[list.length - 1] === undefined ? '' : list[list.length - 1]).replace(',', '.')); return [...list, String(Number.isFinite(last) && last > 0 ? Math.max(0, last - 1) : 0)]; };
  const dropPlace = list => (list.length > 1 ? list.slice(0, -1) : list);

  const api = { field, has, sync, syncKind, boxRows, listOf, joinList, addPlace, dropPlace, nth, MAX_BOXES };
  root.FormUI = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
