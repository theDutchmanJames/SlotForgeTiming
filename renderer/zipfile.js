// A small zip writer (files stored, not compressed) so the app can hand out the Arduino sketch as one .zip without a library or the main process.
// make([{ name, text }]) -> Uint8Array of a zip file that every unzipper opens. Names use '/' for folders ("SlotForgeBox/SlotForgeBox.ino").
(function (root) {
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = bytes => { let c = 0xFFFFFFFF; for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const utf8 = s => { if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s); return Uint8Array.from(Buffer.from(s, 'utf8')); };
  // MS-DOS date and time of now (the zip format's time stamps)
  const dosTime = d => ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF;
  const dosDate = d => (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
  function make(files, when = new Date()) {
    const parts = [], central = []; let offset = 0;
    const w16 = (a, v) => a.push(v & 0xFF, (v >>> 8) & 0xFF), w32 = (a, v) => a.push(v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF);
    files.forEach(f => {
      const name = utf8(f.name), data = f.bytes || utf8(f.text || ''), crc = crc32(data), t = dosTime(when), d = dosDate(when);
      const local = []; w32(local, 0x04034b50); w16(local, 20); w16(local, 0x0800); w16(local, 0); w16(local, t); w16(local, d); w32(local, crc); w32(local, data.length); w32(local, data.length); w16(local, name.length); w16(local, 0);
      parts.push(Uint8Array.from(local), name, data);
      const c = []; w32(c, 0x02014b50); w16(c, 20); w16(c, 20); w16(c, 0x0800); w16(c, 0); w16(c, t); w16(c, d); w32(c, crc); w32(c, data.length); w32(c, data.length); w16(c, name.length); w16(c, 0); w16(c, 0); w16(c, 0); w16(c, 0); w32(c, 0); w32(c, offset);
      central.push(Uint8Array.from(c), name);
      offset += local.length + name.length + data.length;
    });
    const cdSize = central.reduce((n, a) => n + a.length, 0), end = [];
    w32(end, 0x06054b50); w16(end, 0); w16(end, 0); w16(end, files.length); w16(end, files.length); w32(end, cdSize); w32(end, offset); w16(end, 0);
    const all = parts.concat(central, [Uint8Array.from(end)]), outBytes = new Uint8Array(all.reduce((n, a) => n + a.length, 0)); let p = 0;
    all.forEach(a => { outBytes.set(a, p); p += a.length; });
    return outBytes;
  }
  const api = { make, crc32 };
  root.ZipFile = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
