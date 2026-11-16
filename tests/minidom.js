// A very small page for the tests of the lane cards (this repo has no jsdom): elements with attributes, data-attributes, children, closest(), querySelector() for simple selectors
// ([attr], [attr="v"], .class, tag, and those put together, separated by commas) and the listeners of the document. It is as much of a page as lanecards.js needs, no more.
// Dom({ lenient: true }) gives elements that answer any other method with a harmless stand-in, so a whole app screen (the Proxy page of the screen tests) can build with them.
const kebab = k => 'data-' + String(k).replace(/[A-Z]/g, c => '-' + c.toLowerCase());
class El {
  constructor(tag, doc) {
    this.tag = String(tag).toLowerCase(); this.doc = doc; this.parent = null; this.children = []; this.attrs = {}; this.className = ''; this.hidden = false; this.disabled = false; this.checked = false; this.value = ''; this.style = new Proxy({}, { get: (t, k) => (k in t ? t[k] : /^(setProperty|removeProperty|getPropertyValue)$/.test(String(k)) ? () => '' : undefined) });
    this.classList = { add: (...c) => { const l = this.className.split(/\s+/).filter(Boolean); c.forEach(x => { if (!l.includes(x)) l.push(x); }); this.className = l.join(' '); }, remove: (...c) => { this.className = this.className.split(/\s+/).filter(x => x && !c.includes(x)).join(' '); }, toggle: (c, f) => { const has = this.className.split(/\s+/).includes(c), on = f === undefined ? !has : !!f; this.classList[on ? 'add' : 'remove'](c); return on; }, contains: c => this.className.split(/\s+/).includes(c) };
    this._text = ''; this._html = ''; this.isRoot = false; this.focused = false; this.title = '';
    this.dataset = new Proxy({}, { get: (t, k) => (typeof k === 'string' && this.attrs[kebab(k)] !== undefined ? this.attrs[kebab(k)] : undefined), set: (t, k, v) => { this.attrs[kebab(k)] = String(v); return true; }, has: (t, k) => this.attrs[kebab(k)] !== undefined });
    doc.created.push(this);
  }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); this.children = []; }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v); if (v === '') { this.children.forEach(c => { c.parent = null; }); this.children = []; this._text = ''; } }
  get isConnected() { let e = this; while (e) { if (e.isRoot) return true; e = e.parent; } return false; }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'class') this.className = String(v); if (k === 'title') this.title = String(v); if (k === 'value') this.value = String(v); }
  getAttribute(k) { return k === 'class' ? this.className : k in this.attrs ? this.attrs[k] : null; }
  hasAttribute(k) { return k in this.attrs; }
  removeAttribute(k) { delete this.attrs[k]; }
  appendChild(c) { if (c.parent) c.parent.children = c.parent.children.filter(x => x !== c); c.parent = this; this.children.push(c); return c; }
  contains(o) { for (let e = o; e; e = e.parent) if (e === this) return true; return false; }
  focus() { this.focused = true; this.doc.active = this; }
  blur() { this.focused = false; if (this.doc.active === this) this.doc.active = null; }
  matches(sel) { return String(sel).split(',').some(part => this._one(part.trim())); }
  _one(s) {
    const re = /(\[([\w-]+)(?:="([^"]*)")?\])|(\.([\w-]+))|(^[a-z][\w-]*)/gi; let m, any = false;
    while ((m = re.exec(s))) {
      any = true;
      if (m[1]) { if (!(m[2] in this.attrs && (m[3] === undefined || this.attrs[m[2]] === m[3]))) return false; }
      else if (m[4]) { if (!this.className.split(/\s+/).includes(m[5])) return false; }
      else if (m[6] && this.tag !== m[6].toLowerCase()) return false;
    }
    return any;
  }
  closest(sel) { for (let e = this; e; e = e.parent) if (e.matches(sel)) return e; return null; }
  querySelectorAll(sel) { const out = []; const walk = e => e.children.forEach(c => { if (c.matches(sel)) out.push(c); walk(c); }); walk(this); return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  // what a person sees: the element and everything above it are shown
  get visible() { for (let e = this; e; e = e.parent) if (e.hidden) return false; return true; }
}
class Dom {
  constructor(o = {}) {
    this.created = []; this.active = null; this.listeners = {}; this.lenient = !!o.lenient;
    this.document = { createElement: tag => this.make(tag), addEventListener: (t, f) => { (this.listeners[t] = this.listeners[t] || new Set()).add(f); }, removeEventListener: (t, f) => { if (this.listeners[t]) this.listeners[t].delete(f); }, get activeElement() { return null; } };
  }
  make(tag) {
    const el = new El(tag, this);
    return this.lenient ? new Proxy(el, { get: (t, k) => (k in t || typeof k === 'symbol' ? t[k] : () => ({})), set: (t, k, v) => { t[k] = v; return true; } }) : el;
  }
  // a page part that the test builds into: marked as the root of the page, so what hangs under it is connected
  root(tag = 'div') { const el = new El(tag, this); el.isRoot = true; return el; }
  // what the document listeners are told (a click anywhere, a key)
  fire(type, ev) { (this.listeners[type] ? [...this.listeners[type]] : []).forEach(f => f(ev)); }
  count(type) { return this.listeners[type] ? this.listeners[type].size : 0; }
}
module.exports = { Dom, El };
