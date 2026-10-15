// The standard avatars: a picture for each lane, shown by the Avatar widget for a driver who has no picture of their own (or for a lane with nobody in it),
// so there is always something to see. A picture set of the kind "Avatars" (Customization > Image Settings) replaces them, lane by lane.
// To change the standard pictures themselves: put your own eight pictures (data: addresses of PNG files, transparency is kept) in STANDARD below.
(function (root) {
  const LANES = 8;
  const COLORS = ['#d62828', '#2a6fdb', '#2ea44f', '#f2b01e', '#8e44ad', '#e67e22', '#16a2b8', '#c2185b'];
  // a placeholder: a driver's head and shoulders on the colour of the lane, with the lane number
  const placeholder = i => {
    const c = COLORS[i % COLORS.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="${c}"/><circle cx="100" cy="76" r="36" fill="#fff" fill-opacity=".92"/>`
      + `<path d="M28 200c0-50 32-80 72-80s72 30 72 80z" fill="#fff" fill-opacity=".92"/><text x="100" y="184" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="44" fill="${c}">${i + 1}</text></svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  };
  const STANDARD = Array.from({ length: LANES }, (_, i) => placeholder(i));
  // the picture for a lane (0 = lane 1): the picture of the chosen set when it has one for that lane, else the standard one. opt: the settings of an Avatar widget.
  // A widget set to "no avatars" (imageSet: 'none') gives nothing: the first letter of the name is shown instead.
  const forLane = (opt, lane) => {
    if (opt && opt.imageSet === 'none') return '';
    const n = Math.round(Number(lane));
    if (!Number.isFinite(n) || n < 0 || n >= LANES) return '';
    const own = opt && opt.laneAvatars && typeof opt.laneAvatars === 'object' ? opt.laneAvatars[String(n + 1)] : '';
    return (typeof own === 'string' && own) || STANDARD[n];
  };
  const api = { LANES, STANDARD, forLane };
  root.Avatars = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
