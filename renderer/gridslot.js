// (2.4.0) Grid Slot: the lanes of Start a race on Home in balanced rows. How many lanes a row holds is set in styles.css (--hs-cols, by the width of
// the card); this makes the lanes of a last row that is not full share its whole width (8 lanes in rows of 3: 3 + 3 + 2, the last two each half),
// so the grid never shows an empty place. The lanes sit on a grid of 12 small columns; a lane spans 12 / lanes-in-its-row of them.
(() => {
  if (typeof document === 'undefined' || typeof ResizeObserver === 'undefined') return;
  const seen = new WeakSet();
  const fit = box => {
    const lanes = [...box.children].filter(c => c.classList.contains('lane'));
    const cols = Math.max(1, Math.min(4, parseInt(getComputedStyle(box).getPropertyValue('--hs-cols'), 10) || 1));
    const rest = lanes.length % cols;
    box.classList.add('gs-fill');
    lanes.forEach((l, i) => {
      const inLast = rest && i >= lanes.length - rest;
      const span = 12 / (inLast ? rest : cols);
      const v = 'span ' + span;
      if (l.style.gridColumn !== v) l.style.gridColumn = v;
    });
  };
  const watch = box => {
    if (seen.has(box)) return fit(box);
    seen.add(box);
    new ResizeObserver(() => fit(box)).observe(box);
    fit(box);
  };
  const scan = () => document.querySelectorAll('#hmc-start .hs-lanes').forEach(watch);
  let pending = false;
  const start = () => {
    new MutationObserver(() => {
      if (pending || (typeof state !== 'undefined' && state.tab === 'race')) return; // (2.4.0: the race screen redraws all the time and has no Start a race)
      pending = true;
      queueMicrotask(() => {
        pending = false;
        scan();
      });
    }).observe(document.body, { childList: true, subtree: true });
    scan();
  };
  if (document.readyState !== 'loading') start();
  else document.addEventListener('DOMContentLoaded', start);
})();
