// The size of the interface (App Settings > General > Display): the main window is zoomed like the browser zoom, so the text, the buttons and the check boxes grow together.
// The race screens are fitted to the window anyway, so the widgets of a layout keep their size on the screen (their size is set in the Layout Editor).
// Pure: it only says which sizes there are and turns a saved value into a zoom factor.
(function (root) {
  const LEVELS = [[100, '100% (standard)'], [110, '110%'], [125, '125%'], [150, '150%'], [175, '175% (large)'], [200, '200% (very large)']];
  const DEFAULT = 100;
  // the percent of a saved value: one of the sizes above, anything else is the standard
  const levelOf = v => { const n = Number(v); return LEVELS.some(l => l[0] === n) ? n : DEFAULT; };
  const factorOf = v => levelOf(v) / 100; // (what the window is zoomed by: 1 is the standard)
  const api = { LEVELS, DEFAULT, levelOf, factorOf };
  root.UiScale = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
