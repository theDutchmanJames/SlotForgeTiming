// The header picture on the Home tab: how tall its box is, and which part of the picture shows when it does not fit the box.
// Pure functions, so they can be tested without a screen.
(function (root) {
  // The height of the box is a percentage of the window width (5 to 60), so it looks the same on every screen. 0 = automatic: the shape of the picture, 220 px at most (styles.css).
  const height = s => { const n = Math.round(Number(s.homeHeaderHeight)); return n >= 5 && n <= 60 ? n : 0; };

  // The part of the picture that stays in view when it is cropped: x and y in percent, from 0 (the left / top of the picture) to 100 (the right / bottom). 50 and 50 is the middle.
  const percent = v => { const n = typeof v === 'string' && !v.trim() ? NaN : Number(v); return (typeof v === 'number' || typeof v === 'string') && Number.isFinite(n) ? Math.round(Math.min(100, Math.max(0, n)) * 10) / 10 : 50; };
  const pos = s => { const p = (s && s.homeHeaderPos) || {}; return { x: percent(p.x), y: percent(p.y) }; };

  // the style that moves a picture inside its box (nothing when it is in the middle)
  const posCss = p => (p.x === 50 && p.y === 50 ? '' : `object-position:${p.x}% ${p.y}%`);

  // the style of the picture; `automatic` is added when the height is automatic
  const css = (s, automatic = '') => {
    const n = height(s);
    return [n ? `aspect-ratio:100 / ${n};max-height:none` : automatic, posCss(pos(s))].filter(Boolean).join(';');
  };

  // ---- the club logo beside the header picture ----
  const DEFAULT_HEIGHT = 18; // the height (share of the width) of a header that has a logo but no picture, when none is set
  const LOGO_SIDES = ['left', 'right'];
  // 'left' or 'right' of the header picture; '' = not shown
  const logoSide = s => (s && LOGO_SIDES.includes(s.homeLogoSide) ? s.homeLogoSide : '');
  // the logo is shown when there is a logo and a side
  const logoOn = s => !!(s && typeof s.clubLogo === 'string' && s.clubLogo && logoSide(s));
  // the share of the header width that the logo gets: 10 to 50 percent (25 when nothing usable is set)
  const logoShare = s => {
    const v = s && s.homeLogoShare, n = typeof v === 'number' || (typeof v === 'string' && v.trim()) ? Math.round(Number(v)) : NaN;
    return Number.isFinite(n) ? Math.min(50, Math.max(10, n)) : 25;
  };
  // where the logo sits inside its space, in percent: 50 and 50 is the middle (the logo is always shown whole, so it can only move along the side that has room)
  const logoPos = s => { const p = (s && s.homeLogoPos) || {}; return { x: percent(p.x), y: percent(p.y) }; };

  // the style of the header when a logo is shown: the two columns, and the height (a set one, or the default when there is no picture; with a picture and an automatic height the picture's own shape decides)
  const boxCss = s => {
    const share = logoShare(s), a = `minmax(0,${share}fr)`, b = `minmax(0,${100 - share}fr)`, n = height(s);
    return [`grid-template-columns:${logoSide(s) === 'left' ? a + ' ' + b : b + ' ' + a}`, n ? `aspect-ratio:100 / ${n}` : s.homeHeader ? '' : `aspect-ratio:100 / ${DEFAULT_HEIGHT}`].filter(Boolean).join(';');
  };

  // How much room the logo has left inside its box (px) sideways (x) and up-down (y), for a logo that is shown whole (object-fit: contain): that is how far it can be moved.
  const logoRoom = (box, natural) => {
    if (!(box.w > 0 && box.h > 0 && natural.w > 0 && natural.h > 0)) return { x: 0, y: 0 };
    const scale = Math.min(box.w / natural.w, box.h / natural.h);
    return { x: Math.max(0, box.w - natural.w * scale), y: Math.max(0, box.h - natural.h * scale) };
  };

  // How far the picture sticks out of its box (px) sideways (x) and up-down (y): that is how much it can be moved. box and natural are { w, h }: the box on the screen, and the picture itself.
  const overflow = (box, natural) => {
    if (!(box.w > 0 && box.h > 0 && natural.w > 0 && natural.h > 0)) return { x: 0, y: 0 };
    const scale = Math.max(box.w / natural.w, box.h / natural.h); // the picture fills the box (object-fit: cover)
    return { x: Math.max(0, natural.w * scale - box.w), y: Math.max(0, natural.h * scale - box.h) };
  };

  // The position after the picture is dragged dx, dy pixels from where it was at `from`. The picture follows the pointer, so dragging right shows more of its left side.
  const drag = (box, natural, from, dx, dy) => {
    const o = overflow(box, natural), move = (at, d, room) => (room < 1 ? at : percent(at - d / room * 100));
    return { x: move(from.x, dx, o.x), y: move(from.y, dy, o.y) };
  };

  const api = { height, pos, css, overflow, drag, posCss, DEFAULT_HEIGHT, logoSide, logoOn, logoShare, logoPos, boxCss, logoRoom };
  root.Banner = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
