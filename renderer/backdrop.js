// The background picture of a timing page (a layout), and the filters on it: blur, brightness and colour.
// The picture is its own layer behind the widgets, so a filter never touches the widgets, their text or their colours.
// Pure functions that make CSS text, so they can be tested without a screen.
(function (root) {
  const number = (v, lo, hi, fallback) => {
    const n = typeof v === 'string' && !v.trim() ? NaN : Number(v);
    return (typeof v === 'number' || typeof v === 'string') && Number.isFinite(n) ? Math.round(Math.min(hi, Math.max(lo, n))) : fallback;
  };
  // Only a picture that is embedded in the layout (a data: address from a picture the person chose) is used, nothing that points elsewhere.
  const SAFE_IMAGE = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/;
  const image = l => { const v = l && l.bgImage; return typeof v === 'string' && SAFE_IMAGE.test(v) ? v : ''; };
  const FITS = [['cover', 'Fill the page (crop the edges)'], ['contain', 'Whole picture (bars at the sides)'], ['stretch', 'Stretch to the page']];
  const fit = l => (FITS.some(f => f[0] === (l && l.bgFit)) ? l.bgFit : 'cover');
  const blur = l => number(l && l.bgBlur, 0, 100, 0);             // 0 = sharp, 100 = very blurred
  const brightness = l => number(l && l.bgBrightness, 20, 150, 100); // 100 = as it is
  const saturation = l => number(l && l.bgSaturation, 0, 200, 100);  // 0 = black and white, 100 = as it is
  const BLUR_MAX = 4; // the blur at 100, in cqw (percent of the page width), so it looks the same at any size

  const has = l => !!image(l);
  const css = l => {
    if (!has(l)) return '';
    const b = blur(l), br = brightness(l), sa = saturation(l), f = fit(l), radius = Math.round(b * BLUR_MAX) / 100;
    const filter = [b ? `blur(${radius}cqw)` : '', br !== 100 ? `brightness(${br}%)` : '', sa !== 100 ? `saturate(${sa}%)` : ''].filter(Boolean).join(' ');
    return `background-image:url('${image(l)}');background-repeat:no-repeat;background-position:center;background-size:${f === 'stretch' ? '100% 100%' : f}` +
      (filter ? `;filter:${filter}` : '') + (b ? `;inset:-${Math.round(radius * 2 * 100) / 100}cqw` : ''); // the blurred edge is pushed out of the page
  };
  // (single quotes in url(), so the style can sit inside a double-quoted attribute)
  const html = l => (has(l) ? `<div class="bgpic" style="${css(l)}"></div>` : '');
  // the layer itself, for pages that are built with elements
  const node = l => { if (!has(l)) return null; const el = document.createElement('div'); el.className = 'bgpic'; el.style.cssText = css(l); return el; };
  // what a layout keeps of all this
  const pick = l => ({ bgImage: image(l), bgFit: fit(l), bgBlur: blur(l), bgBrightness: brightness(l), bgSaturation: saturation(l) });

  const api = { image, fit, blur, brightness, saturation, has, css, html, node, pick, FITS, BLUR_MAX };
  root.Backdrop = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
