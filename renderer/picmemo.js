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
  const api = { once, site, BIG, MAX_ENTRIES, MAX_CHARS };
  root.PicMemo = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
