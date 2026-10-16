// The adjust pads (1.12.0): the Race Director adds or takes off penalty points, damage points, race time, laps and championship points with pads that look like [+]  value  [−].
// Every group has its own colour (the minus button is a darker, greyer version of the plus button) and its own list of values, set in App Settings > Race Director.
// This file holds the rules (the lists, the colours, the text), the markup of one pad and the reading of a click. Pure: no page and no settings store, so it runs in the tests too.
(function (root) {
  'use strict';
  // id: the group; key: the setting that holds its values; whole: only whole numbers; places: decimals that are kept; unit: how an amount is written
  const GROUPS = [
    { id: 'points', title: 'Penalty points', note: 'points on the penalty system', key: 'padPoints', defaults: [1, 2, 5], color: '#f2b705', whole: true, places: 0, unit: ['penalty point', 'penalty points'] },
    { id: 'damage', title: 'Damage points', note: 'points on the damage system', key: 'padDamage', defaults: [1, 2, 4], color: '#e5484d', whole: true, places: 0, unit: ['damage point', 'damage points'] },
    { id: 'time', title: 'Time', note: 'seconds on the race time', key: 'padSeconds', defaults: [5, 10, 30], color: '#f08a24', whole: false, places: 3, unit: ['s', 's'] },
    { id: 'laps', title: 'Laps', note: 'laps counted for the car', key: 'padLaps', defaults: [1, 2], color: '#9b7bff', whole: true, places: 0, unit: ['lap', 'laps'] },
    { id: 'champ', title: 'Championship points', note: 'points for the championship', key: 'padChamp', defaults: [1, 2, 5], color: '#3fb950', whole: false, places: 2, unit: ['championship point', 'championship points'] },
  ];
  const MAXV = 6, TOP = 100000, NEUTRAL = '#3a3f47';
  const byId = id => GROUPS.find(g => g.id === id) || null;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fmt = v => String(Math.round(Number(v) * 1000) / 1000);

  // One amount made usable: a positive number with the decimals of the group (whole groups: a whole number, at least 1). Anything else is null.
  function amount(g, v) {
    const x = typeof v === 'string' && v.trim() !== '' ? Number(v.trim()) : v;
    if (typeof x !== 'number' || !Number.isFinite(x) || x <= 0 || x > TOP) return null;
    const f = Math.pow(10, g.places), n = g.whole ? Math.round(x) : Math.round(x * f) / f;
    return n > 0 ? n : null;
  }
  // The text of a list ("1, 2, 5" - separated by commas, semicolons or spaces; a dot for decimals) into numbers.
  const parse = text => String(text === undefined || text === null ? '' : text).split(/[\s,;]+/).filter(Boolean).map(Number);
  // Any list (from the settings, a field, a mistake) made into a good one: positive numbers, no doubles, smallest first, at most six. Nothing usable gives the standard list.
  function clean(id, list) {
    const g = byId(id); if (!g) return [];
    const items = typeof list === 'string' ? parse(list) : Array.isArray(list) ? list : [];
    const out = [...new Set(items.map(v => amount(g, v)).filter(v => v !== null))].sort((a, b) => a - b).slice(0, MAXV);
    return out.length ? out : g.defaults.slice();
  }
  const valuesOf = (s, id) => { const g = byId(id); return g ? clean(id, s && s[g.key]) : []; };
  const listText = list => list.map(fmt).join(', ');
  const layoutOf = s => (s && s.padLayout === 'v' ? 'v' : 'h');
  const signature = s => JSON.stringify([layoutOf(s), GROUPS.map(g => valuesOf(s, g.id))]); // changes when the layout or a list changes: then a page redraws its pads

  // ---- colours: the plus button has the colour of the group; the minus button is the same colour, darker and less coloured (mixed with a dark grey) ----
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const hex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const lin = v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  const lum = h => { const [r, g, b] = rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const mix = (a, b, t) => hex(rgb(a).map((v, k) => v * (1 - t) + rgb(b)[k] * t));
  const minusOf = h => mix(h, NEUTRAL, 0.42);
  const textOn = h => (contrast(h, '#111418') >= contrast(h, '#ffffff') ? '#111418' : '#ffffff'); // (dark letters on a light button, white ones on a dark button: whichever reads better)
  function look(id) {
    const g = byId(id); if (!g) return null;
    const minus = minusOf(g.color);
    return { plus: g.color, plusText: textOn(g.color), minus, minusText: textOn(minus) };
  }
  const styleOf = id => { const l = look(id); return l ? `--pc:${l.plus};--pt:${l.plusText};--mc:${l.minus};--mt:${l.minusText}` : ''; };

  // ---- words ----
  const unitText = (id, n) => { const g = byId(id); return g ? `${fmt(n)}${g.unit[0] === 's' ? ' s' : ' ' + g.unit[Math.abs(n) === 1 ? 0 : 1]}` : fmt(n); };
  // "+10 s to Sam", "−1 lap from Sam": the line under the pads, and what Undo takes back
  function describe(id, n, who) {
    if (!byId(id) || !Number.isFinite(n) || n === 0) return '';
    return `${n < 0 ? '−' : '+'}${unitText(id, Math.abs(n))} ${n < 0 ? 'from' : 'to'} ${who}`;
  }

  // ---- one pad ----
  // o: { group, values (default: the standard list), layout 'h' or 'v', attrs (more attributes for every button, e.g. the car), who (for the screen reader), disabled, hidden }
  // Horizontal: three rows - the plus buttons, the values, the minus buttons - one column per value. Vertical: one row per value, [+] value [−]. The last column or row is a field for any other amount.
  function html(o) {
    const g = byId(o && o.group); if (!g) return '';
    const vals = o.values && o.values.length ? o.values : g.defaults, layout = o.layout === 'v' ? 'v' : 'h', extra = o.attrs ? ' ' + o.attrs : '', dis = o.disabled ? ' disabled' : '';
    const who = o.who ? ` for ${esc(o.who)}` : '';
    const cols = [...vals, null];
    const btn = (sign, v) => `<button type="button" class="pad-btn ${sign > 0 ? 'pad-plus' : 'pad-minus'}" data-pad-do="${g.id}" data-sign="${sign}"${v === null ? ' data-other="1"' : ` data-v="${v}"`}${extra}${dis}`
      + ` aria-label="${sign > 0 ? 'Add' : 'Deduct'} ${v === null ? 'the other amount' : unitText(g.id, v)}${who}" title="${sign > 0 ? 'Add' : 'Deduct'} ${v === null ? 'the amount typed here' : unitText(g.id, v)}">${sign > 0 ? '+' : '−'}</button>`;
    const val = v => (v === null
      ? `<input type="number" class="pad-other" data-pad-other="${g.id}" min="0" step="${g.whole ? 1 : 'any'}" placeholder="other" aria-label="Other amount of ${esc(g.title.toLowerCase())}"${dis}>`
      : `<span class="pad-val">${fmt(v)}${g.unit[0] === 's' ? ' s' : ''}</span>`);
    const plus = cols.map(v => btn(1, v)), mid = cols.map(val), minus = cols.map(v => btn(-1, v));
    const cells = layout === 'h' ? [...plus, ...mid, ...minus] : cols.flatMap((_, k) => [plus[k], mid[k], minus[k]]);
    return `<div class="pad pad-${layout} pad-${g.id}" data-pad="${g.id}" style="${styleOf(g.id)}"${o.hidden ? ' hidden' : ''}>`
      + `<div class="pad-title"><strong>${g.title}</strong> <small class="muted">${g.note}</small></div><div class="pad-grid" style="--n:${cols.length}">${cells.join('')}</div></div>`;
  }
  // The pads of the groups that are asked for, in the order of the groups (o.groups: the ids; the lists and the layout come from the settings).
  const padsHtml = (settings, o = {}) => GROUPS.filter(g => !o.groups || o.groups.includes(g.id))
    .map(g => html({ group: g.id, values: valuesOf(settings, g.id), layout: layoutOf(settings), attrs: o.attrs, who: o.who, disabled: o.disabled, hidden: o.hidden && o.hidden.includes(g.id) })).join('');

  // A click on a button of a pad: { group, amount } with the sign in the amount (a minus is a negative number), or null when there is nothing to do
  // (the field for another amount is empty, zero, negative or text). scope: where to look for that field (default: the pad of the button).
  function read(btn, scope) {
    if (!btn || !btn.dataset || !btn.dataset.padDo) return null;
    const g = byId(btn.dataset.padDo); if (!g) return null;
    const sign = Number(btn.dataset.sign) < 0 ? -1 : 1;
    let v = btn.dataset.v;
    if (btn.dataset.other) {
      const pad = scope || (btn.closest ? btn.closest('.pad') : null), inp = pad && pad.querySelector ? pad.querySelector(`[data-pad-other="${g.id}"]`) : null;
      v = inp ? inp.value : '';
    }
    const n = amount(g, v);
    return n === null ? null : { group: g.id, amount: sign * n };
  }

  // ---- Undo ----
  // The page keeps what its pads did. An entry is { lane, group, amount, text, before, at }: before is the number it started from (in the unit of the amount: seconds, laps, points).
  // The race window does the work, so the page only learns later what really changed (a deduction cannot take penalty points below zero): settle() looks at the numbers it is given
  // and fixes the amount of each entry to what really happened; an entry that changed nothing within `wait` ms is dropped. Undo gives the pad command that takes the last one back.
  function history(limit = 30, wait = 2500) {
    let list = [], undone = '';
    const near = (a, b) => Math.abs(a - b) < 0.0005;
    return {
      // x: { lane, group, amount, text, before, at }; when the last press of this pad has not been seen yet, this one starts where that one was meant to end
      push(x) {
        const prev = list.slice().reverse().find(e => e.lane === x.lane && e.group === x.group && !e.settled);
        list.push({ lane: x.lane, group: x.group, amount: x.amount, text: x.text, before: prev ? prev.before + prev.amount : x.before, at: x.at, settled: false });
        if (list.length > limit) list.shift();
        undone = '';
      },
      settle(valueOf, now) {
        list = list.filter(e => {
          if (e.settled) return true;
          const v = valueOf(e.lane, e.group);
          if (typeof v === 'number' && Number.isFinite(v) && !near(v, e.before)) {
            const moved = v - e.before;
            e.amount = Math.sign(moved) === Math.sign(e.amount) && Math.abs(moved) < Math.abs(e.amount) ? Math.round(moved * 1000) / 1000 : e.amount; // (less than asked: it hit a limit)
            e.settled = true; return true;
          }
          return now - e.at < wait;
        });
      },
      canUndo: () => list.length > 0 && list[list.length - 1].settled,
      // takes the last entry off the list: the command that undoes it, or null
      undo() {
        if (!this.canUndo()) return null;
        const e = list.pop(); undone = e.text;
        return { lane: e.lane, group: e.group, amount: -e.amount };
      },
      // the line under the pads
      line: () => (undone ? `Undone: ${undone}` : list.length ? `Last: ${list[list.length - 1].text}` : 'Nothing adjusted yet.'),
      size: () => list.length, clear() { list = []; undone = ''; },
    };
  }

  const api = { GROUPS, MAXV, byId, amount, parse, clean, valuesOf, listText, layoutOf, signature, look, styleOf, minusOf, textOn, contrast, lum, unitText, describe, html, padsHtml, read, history, fmt };
  root.AdjustPad = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
