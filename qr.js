// Makes a QR code (as an SVG picture) for a web address, so a phone or tablet can scan it.
// The encoder in vendor/QRCode is Kazuhiko Arase's MIT-licensed QR code library (see the LICENSE files there).
const QRCode = require('./vendor/QRCode'), QRErrorCorrectLevel = require('./vendor/QRCode/QRErrorCorrectLevel');

function matrix(text) {
  const q = new QRCode(-1, QRErrorCorrectLevel.M); q.addData(String(text)); q.make();
  const n = q.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => q.isDark(r, c)));
}
// quiet = the white border (in modules); a QR code needs at least 4
function svg(text, quiet = 4) {
  const m = matrix(text), n = m.length, size = n + quiet * 2;
  let path = '';
  m.forEach((row, r) => { let c = 0; while (c < n) { if (!row[c]) { c++; continue; } let e = c; while (e < n && row[e]) e++; path += `M${c + quiet} ${r + quiet}h${e - c}v1h-${e - c}z`; c = e; } });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR code for ${String(text).replace(/[&<>"]/g, '')}"><rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}
module.exports = { matrix, svg };
