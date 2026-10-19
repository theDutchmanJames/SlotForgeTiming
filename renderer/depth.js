// The depth of the app (App Settings > General > Display): how much the cards, buttons, folders and widgets seem to stand up from the page, a little like thick cards and shallow buttons.
// The look itself is written once, in styles.css (the part "Soft lift"); this only says which levels there are and turns a saved value into the number the style sheet works with (--depth, 0 to 1).
// Design: docs/ui-reference/depth. Pure, so it can be tested without a screen.
(function (root) {
  const LEVELS = [[0, 'Flat (no depth)'], [35, 'Soft lift (standard)'], [55, 'Medium'], [75, 'Thick card']];
  const DEFAULT = 35;
  // the level of a saved value: one of the levels above, anything else (also nothing saved yet) is the standard. 0 is a real choice: flat.
  const levelOf = v => {
    if (typeof v !== 'number' && typeof v !== 'string') return DEFAULT;
    if (typeof v === 'string' && !v.trim()) return DEFAULT;
    const n = Number(v);
    return LEVELS.some(l => l[0] === n) ? n : DEFAULT;
  };
  const factorOf = v => levelOf(v) / 100; // (what the style sheet gets: 0 is flat, 0.35 the standard)
  const api = { LEVELS, DEFAULT, levelOf, factorOf };
  root.Depth = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
