// 1.60.0: the page is only written to when a value is different.
// The race screen is brought up to date ten times a second, and many panels write every value again each time (a button's disabled, hidden, title or text, the class of a row...).
// The browser lays out and draws that part of the page again for each of those writes, also when the value is the same, so a slow computer (a Raspberry Pi) works for nothing:
// in a race on 6 lanes more than a thousand writes a second, of which about fifty were real changes.
// This puts a check in front of the usual ways of writing: a write of the value that is already there is left out. Nothing else changes, the page looks and works the same.
// It is a pure module that gets the window to work on (install), so it can be tested without a screen.
(function (root) {
  const counts = { skipped: 0 };
  // Does this write leave the element as it is? (false when in doubt: the write is then done as always)
  const SAME = {
    // textContent: an element with one text node that already has this text, or an empty element that gets ''
    textContent(el, v) {
      if (!el || el.nodeType !== 1) return false;
      const s = v === null || v === undefined ? '' : String(v), first = el.firstChild;
      if (s === '') return !first;
      return first !== null && first === el.lastChild && first.nodeType === 3 && first.data === s;
    },
    hidden: (el, v) => typeof v === 'boolean' && el.hidden === v, // (hidden also takes 'until-found': only a real true or false is compared)
    disabled: (el, v) => el.disabled === !!v,
    title: (el, v) => el.title === String(v),
    className: (el, v) => typeof el.className === 'string' && el.className === String(v)
  };
  const wrapSetter = (proto, prop) => {
    const d = proto && Object.getOwnPropertyDescriptor(proto, prop);
    if (!d || typeof d.set !== 'function' || typeof d.get !== 'function' || d.set.__quiet) return false;
    const set = function (v) { try { if (SAME[prop](this, v)) { counts.skipped++; return; } } catch (x) { /* when in doubt: write */ } d.set.call(this, v); };
    set.__quiet = true;
    Object.defineProperty(proto, prop, { configurable: true, enumerable: d.enumerable, get: d.get, set });
    return true;
  };
  // win: the window (or, in a test, an object with the same classes). Says how many of the ways of writing it could put the check on.
  function install(win) {
    let n = 0;
    if (!win) return n;
    try {
      if (wrapSetter(win.Node && win.Node.prototype, 'textContent')) n++;
      if (wrapSetter(win.Element && win.Element.prototype, 'className')) n++;
      ['hidden', 'title'].forEach(p => { if (wrapSetter(win.HTMLElement && win.HTMLElement.prototype, p)) n++; });
      ['HTMLButtonElement', 'HTMLInputElement', 'HTMLSelectElement', 'HTMLTextAreaElement'].forEach(c => { if (wrapSetter(win[c] && win[c].prototype, 'disabled')) n++; });
      const E = win.Element && win.Element.prototype;
      if (E && typeof E.setAttribute === 'function' && !E.setAttribute.__quiet) {
        const orig = E.setAttribute, f = function (name, value) {
          try { if (this.getAttribute(name) === String(value)) { counts.skipped++; return undefined; } } catch (x) { /* when in doubt: write */ }
          return orig.call(this, name, value);
        };
        f.__quiet = true; E.setAttribute = f; n++;
      }
      const S = win.CSSStyleDeclaration && win.CSSStyleDeclaration.prototype;
      if (S && typeof S.setProperty === 'function' && !S.setProperty.__quiet) {
        const orig = S.setProperty, f = function (name, value, priority) {
          try { if (value !== null && value !== undefined && this.getPropertyValue(name) === String(value) && this.getPropertyPriority(name) === (priority || '')) { counts.skipped++; return undefined; } } catch (x) { /* when in doubt: write */ }
          return orig.call(this, name, value, priority);
        };
        f.__quiet = true; S.setProperty = f; n++;
      }
    } catch (x) { /* a window that can not be changed: the page is written as always */ }
    return n;
  }
  const api = { install, skipped: () => counts.skipped, SAME };
  root.Quiet = api;
  if (typeof module !== 'undefined') module.exports = api;
  if (typeof window !== 'undefined' && window === root && window.Node && window.document) install(window);
})(typeof window !== 'undefined' ? window : globalThis);
