// 1.60.2: the text of a picture is built once.
// A picture in a widget (the car, the avatar, the start lights, a logo, a flag) is put in the page as one long piece of text, and a picture of a few megabytes is a few megabytes of text.
// The race screen is brought up to date ten times a second, and each time every widget made its text again and checked whether it had changed: for a picture that means building
// and comparing several megabytes, ten times a second, for nothing. On a Raspberry Pi 5 that was most of the 77 to 85 ms of one update.
// Here the text is remembered next to what it was made from (the picture itself and the few settings that go with it): the same picture with the same settings gives the very same
// text again, and the very same text is recognised at once, without looking at it. A small picture is not remembered (making it again is cheap), and nothing is changed in what is shown.
(function (root) {
  const BIG = 2000;         // a picture shorter than this (in characters) is built again each time
  const MAX_ENTRIES = 16;   // the pictures remembered by one place that builds text
  const MAX_CHARS = 128e6;  // and the most text it holds on to (a few big pictures); beyond that the oldest are let go
  const site = () => ({ list: [], chars: 0 });
  const same = (a, b) => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  };
  const isBig = v => typeof v === 'string' && v.length >= BIG;
  // deps: everything the text is made from, in a fixed order (strings, numbers, booleans). build(): makes the text.
  function once(s, deps, build) {
    if (!s || !deps.some(isBig)) return build();
    const L = s.list;
    for (let i = 0; i < L.length; i++) {
      if (same(L[i].deps, deps)) { const e = L[i]; if (i > 0) { L.splice(i, 1); L.unshift(e); } return e.html; } // (the one used last comes first)
    }
    const html = build(), size = typeof html === 'string' ? html.length : 0;
    L.unshift({ deps, html, size }); s.chars += size;
    while (L.length > MAX_ENTRIES || (s.chars > MAX_CHARS && L.length > 1)) s.chars -= L.pop().size;
    return html;
  }

  // 1.60.6: a big picture as a short link.
  // Even when the text is built once, the page still has to read it: every time the start lights change (five lights, one picture each) the page was given the five pictures themselves,
  // megabytes of text, and made five pictures from them again. On a Raspberry Pi 5 that took 160 to 190 ms at every light, which is the hitch at the start of a race. Here a big picture
  // is turned into a file in the memory of the window once (a blob) and the page is given its short address (blob:...) instead: writing the five lights takes a few milliseconds, and
  // the page keeps the pictures it has already made. Nothing is changed in what is shown. It is switched on by the app itself (setLinks, app.js); without that, and for anything that is
  // not a big picture made as base64 data, or when anything goes wrong, the picture is given as it was.
  const MAX_LINKS = 256;       // the pictures kept as links by one window
  const MAX_LINK_BYTES = 256e6; // and the most bytes they hold on to; beyond that the oldest is let go
  const links = { on: false, map: new Map(), bytes: 0 };
  const DATA_HEAD = /^data:([^;,]*)(;base64)?,/;
  const bytesOf = b64 => {
    if (typeof Uint8Array.fromBase64 === 'function') return Uint8Array.fromBase64(b64);
    const bin = atob(b64), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  };
  const letGo = e => { try { if (e.size && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(e.url); } catch (x) { /* it is gone either way */ } };
  function link(src) {
    if (!links.on || !isBig(src)) return src;
    const kept = links.map.get(src);
    if (kept) return kept.url;
    let e = { url: src, size: 0 }; // (a picture that cannot be made into a link stays as it is, and is not tried again)
    try {
      const m = DATA_HEAD.exec(src.slice(0, 200));
      if (m && m[2]) {
        const bytes = bytesOf(src.slice(m[0].length));
        e = { url: URL.createObjectURL(new Blob([bytes], { type: m[1] || 'image/png' })), size: bytes.length };
      }
    } catch (x) { e = { url: src, size: 0 }; }
    links.map.set(src, e); links.bytes += e.size;
    for (const [k, old] of links.map) { // (the oldest first: a Map keeps the order it was filled in)
      if (links.map.size <= api.MAX_LINKS && links.bytes <= api.MAX_LINK_BYTES) break;
      if (k === src) break; // (never the one that was just made)
      links.map.delete(k); links.bytes -= old.size; letGo(old);
    }
    return e.url;
  }
  function setLinks(on) { links.on = !!on; if (!on) clearLinks(); }
  function clearLinks() { links.map.forEach(letGo); links.map.clear(); links.bytes = 0; }
  const linkStats = () => ({ on: links.on, count: links.map.size, bytes: links.bytes });

  const api = { once, site, link, setLinks, clearLinks, linkStats, BIG, MAX_ENTRIES, MAX_CHARS, MAX_LINKS, MAX_LINK_BYTES };
  root.PicMemo = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
