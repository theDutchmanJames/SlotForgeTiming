// The standard avatars: a picture for each lane, shown by the Avatar widget for a driver who has no picture of their own (or for a lane with nobody in it),
// so there is always something to see. A picture set of the kind "Avatars" (Customization > Image Settings) replaces them, lane by lane.
// The standard pictures are the files renderer/avatars/Lane1.png to Lane8.png (transparent PNG files, kept exactly as they were made). To change them, replace those files.
(function (root) {
  const LANES = 8;
  const STANDARD = Array.from({ length: LANES }, (_, i) => `avatars/Lane${i + 1}.png`); // (an address in the renderer folder: the app and the Live Race pages on phones both find it there)
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
