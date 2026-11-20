// (2.4.0, SlotForgeRestyle.md "Engineer's Bench") App Settings › Calculations as an Engineer's Bench: the words and lists of the page, pure (plain objects
// in, words out) so they can be tested without a screen. calculationsui.js lays the page out: Try it (nothing is saved) beside Your rules (one save bar),
// then How it is worked out.
(function (root) {
  'use strict';
  // each topic as a question, with one line on what it covers
  const HEAD = {
    pace: [
      'How fast is normal?',
      'Each lap is compared with the driver’s own benchmark. Faster pushes (more wear and fuel), slower saves.'
    ],
    fuel: ['Where does the fuel go?', 'What a lap uses, how fast a car refuels and how the tyres wear, with every effect that adds to it.'],
    effects: ['What changes the race?', 'Balance of Power, weather, damage and the Safety Car: what each one adds or takes away.'],
    resources: ['What is left in the box?', 'Tyre sets, repair credits and components: what a stop uses and what remains.'],
    pits: ['How long is a stop?', 'The order of the work in a pit stop, when the car is released, and what penalties add.'],
    estimates: ['How far can it go?', 'Fuel range, tyre life, gaps and distance: the estimates the race screen shows.'],
    results: ['Who scores what?', 'Which laps count, how races are classified and how heats and championships give points.']
  };
  const head = id => HEAD[id] || ['Calculations', ''];

  // the race setups that use a saved system: the setup field that points to its kind (from the schema), and its id
  function usedBy(setups, fields, entity, id) {
    const keys = (fields || []).filter(f => f.ref === entity).map(f => f.key);
    if (!keys.length || !id) return [];
    return (setups || []).filter(s => keys.some(k => s && s[k] === id)).map(s => s.name || 'Race setup');
  }
  const usedText = names =>
    !names.length
      ? 'Not used by a race setup yet'
      : `Used by ${names.slice(0, 3).join(' · ')}${names.length > 3 ? ` +${names.length - 3}` : ''}`;

  // the formulas of every topic, to find one: [{ topic, title, text }] (from the cards: their title, equation, words and example)
  function index(topics) {
    const out = [];
    for (const t of topics || [])
      for (const f of t.formulas || [])
        out.push({ topic: t.id, topicTitle: t.title, title: f.title, text: [f.title, f.equation, f.text, f.worked].join(' ') });
    return out;
  }
  // the formulas that match the words typed (every word must be in the formula; the title counts double)
  function find(idx, query) {
    const words = String(query || '')
      .toLowerCase()
      .split(/[^a-z0-9%]+/i)
      .filter(w => w.length > 1);
    if (!words.length) return [];
    return (idx || [])
      .map(f => {
        const hay = f.text.toLowerCase(),
          title = f.title.toLowerCase();
        if (!words.every(w => hay.includes(w))) return null;
        return { ...f, score: words.reduce((s, w) => s + (title.includes(w) ? 2 : 1), 0) };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
      .slice(0, 8);
  }

  // the earlier laps as bars, with the benchmark line and the new lap: { bars: [{ s, pct, out }], ref: { s, pct }, lap: { s, pct }, min, max }
  function lapBars(laps, refSec, lapSec, left = []) {
    const all = [...laps, lapSec, refSec].filter(n => Number.isFinite(n) && n > 0);
    if (!all.length) return null;
    const lo = Math.min(...all),
      hi = Math.max(...all),
      span = Math.max(0.001, hi - lo);
    const min = lo - span * 0.6,
      max = hi + span * 0.15;
    const pct = s => Math.round(((s - min) / (max - min)) * 1000) / 10;
    return {
      bars: laps.map((s, i) => ({ s, pct: pct(s), out: !!left[i] })),
      ref: refSec > 0 ? { s: refSec, pct: pct(refSec) } : null,
      lap: lapSec > 0 ? { s: lapSec, pct: pct(lapSec) } : null,
      min,
      max
    };
  }
  // the words of a lap against its benchmark, from the pace difference and the multipliers of Push & Save
  function verdict(pace, effect) {
    if (pace === null || pace === undefined || !Number.isFinite(pace)) return { head: 'No benchmark yet', state: 'normal' };
    const fast = pace < 0,
      size = `${Math.abs(pace).toFixed(1)}% ${fast ? 'faster' : pace > 0 ? 'slower' : ''}`.trim();
    const t = effect && Number.isFinite(effect.tyres) ? effect.tyres : 1;
    const state = t > 1.0001 ? 'push' : t < 0.9999 ? 'save' : 'normal';
    const full = effect && effect.full;
    const word = state === 'push' ? (full ? 'full push' : 'pushing') : state === 'save' ? (full ? 'full save' : 'saving') : 'normal';
    return { head: pace === 0 ? `At the benchmark · ${word}` : `${size} · ${word}`, state };
  }
  const pctOf = m => `${m >= 1 ? '+' : '−'}${Math.round(Math.abs(m - 1) * 1000) / 10}%`;

  // the formula sheet: every topic and its formulas as one page to print or save (a complete HTML document)
  function sheetHtml(topics, o = {}) {
    const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const body = (topics || [])
      .map(
        t =>
          `<section><h2>${e(t.title)}</h2><p class="q">${e(head(t.id)[0])} ${e(head(t.id)[1])}</p>${(t.formulas || [])
            .map(
              f =>
                `<article><h3>${e(f.title)}</h3><pre>${e(f.equation)}</pre><p>${e(f.text)}</p>${f.worked ? `<p class="ex"><b>Example</b> ${e(f.worked)}</p>` : ''}</article>`
            )
            .join('')}</section>`
      )
      .join('');
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(o.title || 'Race calculations')}</title><style>
body{margin:0 auto;max-width:900px;padding:28px 20px;font:15px/1.5 system-ui,'Segoe UI',sans-serif;color:#1d2330;background:#fff}
h1{margin:0 0 4px;font:800 italic 34px/1 'Bahnschrift',sans-serif;text-transform:uppercase}.sub{margin:0 0 24px;color:#5b6472}
h2{margin:28px 0 4px;padding-top:12px;border-top:3px solid #e5484d;font:800 italic 24px/1.1 'Bahnschrift',sans-serif;text-transform:uppercase}.q{margin:0 0 12px;color:#5b6472}
article{margin:0 0 12px;padding:12px 14px;border:1px solid #d9dde3;border-radius:10px;break-inside:avoid}h3{margin:0 0 6px;font-size:16px}
pre{margin:0 0 8px;padding:8px 10px;border-radius:8px;background:#f1f3f6;font:13px/1.45 Consolas,monospace;white-space:pre-wrap}p{margin:0 0 6px}.ex{color:#5b6472}
@media print{body{padding:0}h2{break-after:avoid}}
</style></head><body><h1>${e(o.title || 'Race calculations')}</h1><p class="sub">${e(o.sub || 'How SlotForge Timing works out pace, fuel, tyres, pit stops, estimates and scores.')}</p>${body}</body></html>`;
  }

  const api = { HEAD, head, usedBy, usedText, index, find, lapBars, verdict, pctOf, sheetHtml };
  root.CalcBench = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
