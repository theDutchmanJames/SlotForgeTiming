// What happens to a picture the person uploads (a driver, a slotcar, a widget, a picture set, the header or the logo).
// Pure: it only decides; the canvas work is done by resizeImage in database.js.
//
// The quality setting (App Settings > General > Pictures):
//  - original: the file is saved as it is (no resizing, no new compression, transparency and GIF animation stay). Only a picture that is longer than 4000 px or bigger than 12 MB is shrunk.
//  - high: nothing is larger than 2000 px; a picture that fits is saved as it is.
//  - standard: the small sizes of the older versions (the size each place was made for), re-saved at 85% quality.
// A picture is re-saved in the kind it came in: a JPEG stays a JPEG, anything else (PNG, WebP, GIF) becomes a PNG so its transparency is kept
// (versions before 1.1.0 turned every driver and slotcar picture into a JPEG with a white background).
(function (root) {
  const LEVELS = [['original', 'Original (as uploaded)'], ['high', 'High (up to 2000 px)'], ['standard', 'Standard (small, up to about 1000 px)']];
  const DEFAULT_LEVEL = 'original';
  const CAPS = { original: 4000, high: 2000 };
  const MAX_KEEP = 12 * 1024 * 1024; // a file bigger than this is always re-saved smaller
  const NOTE = ' How sharp uploaded pictures stay is set in App Settings > General > Pictures.';
  const levelOf = v => (LEVELS.some(l => l[0] === v) ? v : DEFAULT_LEVEL);
  // file: { type, size }; dim: { width, height }; max: the size this place was made for (used by "standard")
  // Gives { keep: true } (save the file as it is) or { keep: false, width, height, mime, quality } (draw it at that size and save it again).
  function plan(file, dim, level, max) {
    const lvl = levelOf(level), type = String((file && file.type) || '').toLowerCase();
    const w = Math.max(1, Math.round(Number(dim && dim.width) || 1)), h = Math.max(1, Math.round(Number(dim && dim.height) || 1));
    const cap = lvl === 'standard' ? Math.max(16, Math.round(Number(max) || 512)) : CAPS[lvl], k = Math.min(1, cap / Math.max(w, h));
    const small = (Number(file && file.size) || 0) <= MAX_KEEP;
    if (lvl !== 'standard' && k === 1 && small) return { keep: true };
    if (type === 'image/svg+xml' && small && lvl !== 'standard') return { keep: true }; // (a vector picture has no pixels to shrink)
    return { keep: false, width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)), mime: type === 'image/jpeg' ? 'image/jpeg' : 'image/png', quality: lvl === 'standard' ? 0.85 : 0.92 };
  }
  // Reads an uploaded file and gives the address (data:...) to keep. file: the chosen File; max: the size the place was made for; level: the quality setting.
  // env is what the page offers, so this can be tried without a page: { url: { create(file), revoke(url) }, newImage(), newCanvas(w, h) (with getContext('2d') and toDataURL(mime, quality)), read(file) -> Promise<string> }
  function load(file, max, level, env) {
    return new Promise((resolve, reject) => {
      const url = env.url.create(file), img = env.newImage();
      img.onload = () => {
        env.url.revoke(url);
        const p = plan({ type: file.type, size: file.size }, { width: img.naturalWidth || img.width, height: img.naturalHeight || img.height }, level, max);
        if (p.keep) return env.read(file).then(resolve, reject);
        const c = env.newCanvas(p.width, p.height), g = c.getContext('2d');
        if (p.mime === 'image/jpeg') { g.fillStyle = '#fff'; g.fillRect(0, 0, p.width, p.height); } // (a JPEG has no transparency; every other picture is saved as a PNG, which keeps it)
        g.drawImage(img, 0, 0, p.width, p.height);
        resolve(c.toDataURL(p.mime, p.quality));
      };
      img.onerror = () => { env.url.revoke(url); reject(new Error('That file is not a picture.')); };
      img.src = url;
    });
  }
  const api = { LEVELS, DEFAULT_LEVEL, CAPS, MAX_KEEP, NOTE, levelOf, plan, load };
  root.Picture = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
