// (2.4.0, SlotForgeRestyle.md "Try It") what the Layout Editor checks and tells: the words of a custom text a widget does not know ({lapsleft} on a
// lane), the race setups that use a layout (main screen or second display), and what deleting a layout changes in them. Pure: editor.js shows it,
// tests/layouttry.test.js checks it in Node.
(function (root) {
  'use strict';
  const W = () => (typeof module !== 'undefined' ? require('./widgets.js') : root.Widgets);
  const LANE = () => W().TEXT_LANE_VARS.map(v => v[0]),
    RACE = () => W().TEXT_RACE_VARS.map(v => v[0]);
  // the same thing for a lane and for the whole race
  const SAME = {
    lapsleft: 'lapstogo',
    lapstogo: 'lapsleft',
    racedistance: 'distleft',
    distleft: 'racedistance',
    trackrecord: 'record',
    record: 'trackrecord'
  };
  // one letter wrong, missing, extra or two swapped, twice at most ("nmae" for "name")
  function dist(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    return d[a.length][b.length];
  }
  const prefix = (a, b) => {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return i;
  };
  // the words of a custom text widget it does not fill: [{ word, other: 'race' | 'lane' | '', suggest }]
  function unknownWords(w) {
    if (!w || !['textlane', 'textrace'].includes(w.type)) return [];
    const opt = w.opt || {};
    if (opt.composition) return []; // (a composed text picks its values from a list: nothing typed by hand)
    const lane = w.type === 'textlane',
      text = opt.text ?? (lane ? W().TEXT_LANE_DEFAULT : W().TEXT_RACE_DEFAULT),
      own = lane ? LANE() : RACE(),
      other = lane ? RACE() : LANE();
    const seen = new Set(),
      out = [];
    String(text).replace(/\{(\w+)\}/g, (m, k) => {
      if (own.includes(k) || seen.has(k)) return m;
      seen.add(k);
      const typo = own
          .map(x => [x, dist(x, k)])
          .filter(([, n]) => n <= (k.length > 4 ? 2 : 1))
          .sort((a, b) => a[1] - b[1])[0],
        start = own
          .map(x => [x, prefix(x, k)])
          .filter(([, n]) => n >= 4)
          .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0];
      const suggest = (SAME[k] && own.includes(SAME[k]) && SAME[k]) || (typo && typo[0]) || (start && start[0]) || '';
      out.push({ word: k, other: other.includes(k) ? (lane ? 'race' : 'lane') : '', suggest });
      return m;
    });
    return out;
  }
  // the widgets of a layout with words they do not know: [{ index, title, lane, words }]
  function problems(layout) {
    return ((layout && layout.widgets) || [])
      .map((w, index) => ({ index, w, words: unknownWords(w) }))
      .filter(x => x.words.length)
      .map(({ index, w, words }) => ({
        index,
        title: w.title || (w.type === 'textlane' ? 'Custom text (per lane)' : 'Custom text (race)'),
        lane: w.type === 'textlane' ? (w.lane || 0) + 1 : 0,
        words
      }));
  }
  // one line of advice for a word
  function advice(x, type) {
    const where = type === 'textlane' ? 'a lane' : 'the whole race';
    if (x.other === 'race')
      return `{${x.word}} is a word of the whole race, not of a lane. ${x.suggest ? `On a lane use {${x.suggest}}, or put it in a race text widget.` : 'Put it in a race text widget.'}`;
    if (x.other === 'lane')
      return `{${x.word}} is a word of a lane, not of the whole race. ${x.suggest ? `Use {${x.suggest}}, or put it in a lane text widget.` : 'Put it in a lane text widget.'}`;
    return `{${x.word}} is not a word of ${where}.${x.suggest ? ` Did you mean {${x.suggest}}?` : ''} It shows as typed.`;
  }
  // the race setups that use a layout: [{ id, name, screen: 'main' | 'second' }]
  function usedBy(setups, id) {
    const out = [];
    (setups || []).forEach(s => {
      if (!s || !id) return;
      if (s.layout === id) out.push({ id: s.id, name: s.name || '(unnamed)', screen: 'main' });
      if (s.layout2 === id) out.push({ id: s.id, name: s.name || '(unnamed)', screen: 'second' });
    });
    return out;
  }
  // deleting a layout: the changes to the race setups that use it, with what they use instead ('' = the default layout; on the second display:
  // the same as the main screen) -> [{ id, patch }]
  function deletePlan(setups, id, instead = '') {
    const by = new Map();
    usedBy(setups, id).forEach(u => {
      const p = by.get(u.id) || {};
      p[u.screen === 'main' ? 'layout' : 'layout2'] = instead === id ? '' : instead || '';
      by.set(u.id, p);
    });
    return [...by].map(([sid, patch]) => ({ id: sid, patch }));
  }
  const api = { unknownWords, problems, advice, usedBy, deletePlan };
  root.LayoutCheck = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
