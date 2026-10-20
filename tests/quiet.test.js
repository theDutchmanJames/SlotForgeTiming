// 1.60.0: the page is only written to when a value is different (renderer/quiet.js), and a widget whose text changes is not given the same colours again (renderer/canvas.js).
// Against a stand-in for the window with the same classes and setters as a browser (a write that is done is counted).
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..') + '/';
const Quiet = require(R + 'renderer/quiet.js');
let fails = 0;
const say = (m, c) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

// ---- a window like a browser's, where every write that is done is counted ----
const writes = [];
class Node_ {
  constructor(type = 1) { this.nodeType = type; this.childNodes = []; this.data = ''; }
  get firstChild() { return this.childNodes[0] || null; }
  get lastChild() { return this.childNodes[this.childNodes.length - 1] || null; }
  get textContent() { return this.nodeType === 3 ? this.data : this.childNodes.map(c => c.textContent).join(''); }
  set textContent(v) { writes.push('textContent'); const s = v === null ? '' : String(v); if (this.nodeType === 3) this.data = s; else { this.childNodes = s === '' ? [] : [Object.assign(new Node_(3), { data: s })]; } }
}
class Element_ extends Node_ {
  constructor() { super(1); this.attrs = {}; this._class = ''; }
  get className() { return this._class; } set className(v) { writes.push('className'); this._class = String(v); }
  setAttribute(n, v) { writes.push('setAttribute'); this.attrs[n] = String(v); }
  getAttribute(n) { return n in this.attrs ? this.attrs[n] : null; }
}
class HTMLElement_ extends Element_ {
  constructor() { super(); this._hidden = false; this._title = ''; }
  get hidden() { return this._hidden; } set hidden(v) { writes.push('hidden'); this._hidden = v === 'until-found' ? v : !!v; }
  get title() { return this._title; } set title(v) { writes.push('title'); this._title = String(v); }
}
class HTMLButtonElement_ extends HTMLElement_ { constructor() { super(); this._d = false; } get disabled() { return this._d; } set disabled(v) { writes.push('disabled'); this._d = !!v; } }
class HTMLInputElement_ extends HTMLElement_ { constructor() { super(); this._d = false; } get disabled() { return this._d; } set disabled(v) { writes.push('disabled'); this._d = !!v; } }
class HTMLSelectElement_ extends HTMLElement_ { constructor() { super(); this._d = false; } get disabled() { return this._d; } set disabled(v) { writes.push('disabled'); this._d = !!v; } }
class HTMLTextAreaElement_ extends HTMLElement_ { constructor() { super(); this._d = false; } get disabled() { return this._d; } set disabled(v) { writes.push('disabled'); this._d = !!v; } }
class CSSStyleDeclaration_ {
  constructor() { this.p = {}; }
  setProperty(n, v, pr) { writes.push('setProperty'); if (v === null || v === '') delete this.p[n]; else this.p[n] = [String(v), pr || '']; }
  getPropertyValue(n) { return this.p[n] ? this.p[n][0] : ''; }
  getPropertyPriority(n) { return this.p[n] ? this.p[n][1] : ''; }
}
const win = { Node: Node_, Element: Element_, HTMLElement: HTMLElement_, HTMLButtonElement: HTMLButtonElement_, HTMLInputElement: HTMLInputElement_, HTMLSelectElement: HTMLSelectElement_, HTMLTextAreaElement: HTMLTextAreaElement_, CSSStyleDeclaration: CSSStyleDeclaration_ };

const patched = Quiet.install(win);
say('install puts the check on ten ways of writing (text, class, hidden, title, disabled of four kinds of element, attribute, style property)', patched === 10);
say('...a second install changes nothing (no check on top of a check)', Quiet.install(win) === 0);
const count = f => { writes.length = 0; const s0 = Quiet.skipped(); f(); return { done: writes.length, skipped: Quiet.skipped() - s0 }; };
const done = f => count(f).done, skipped = f => count(f).skipped;

{ const el = new HTMLButtonElement_();
  say('text: a first text is written; the same text again is left out; another text is written', done(() => { el.textContent = 'Pit 1'; }) === 1 && done(() => { el.textContent = 'Pit 1'; }) === 0 && done(() => { el.textContent = 'Leave pit 1'; }) === 1 && el.textContent === 'Leave pit 1');
  say('...and the writes that were left out are counted', skipped(() => { el.textContent = 'Leave pit 1'; el.textContent = 'Leave pit 1'; }) === 2);
  const e = new HTMLElement_();
  say('text: an empty element that gets "" (or null) is left alone; one with text is emptied', done(() => { e.textContent = ''; e.textContent = null; }) === 0 && done(() => { e.textContent = 'x'; }) === 1 && done(() => { e.textContent = ''; }) === 1 && e.childNodes.length === 0);
  const parent = new HTMLElement_(); parent.childNodes = [new HTMLElement_()];
  say('text: "" on an element that has child elements still empties it (the text of the children is empty, the children are not)', done(() => { parent.textContent = ''; }) === 1 && parent.childNodes.length === 0);
  const two = new HTMLElement_(); two.childNodes = [Object.assign(new Node_(3), { data: 'a' }), Object.assign(new Node_(3), { data: 'b' })];
  say('text: an element with two text nodes is written, also when the text is the same ("ab"), so it ends with one', done(() => { two.textContent = 'ab'; }) === 1 && two.childNodes.length === 1);
  const t = Object.assign(new Node_(3), { data: 'q' });
  say('text: a text node itself is always written', done(() => { t.textContent = 'q'; }) === 1);
  say('text: a number is compared as text (5 over "5" is left out)', done(() => { e.textContent = 5; }) === 1 && done(() => { e.textContent = 5; e.textContent = '5'; }) === 0); }

{ const el = new HTMLElement_();
  say('hidden: false over false is left out; true is written once, then left out; false again is written', done(() => { el.hidden = false; }) === 0 && done(() => { el.hidden = true; }) === 1 && done(() => { el.hidden = true; }) === 0 && done(() => { el.hidden = false; }) === 1);
  say('hidden: only a real true or false is compared (1, "until-found" and the like are written as always)', done(() => { el.hidden = 0; }) === 1 && done(() => { el.hidden = 'until-found'; }) === 1 && done(() => { el.hidden = 'until-found'; }) === 1);
  say('title: the same title is left out; another is written; a number is compared as text', done(() => { el.title = 'Not now'; }) === 1 && done(() => { el.title = 'Not now'; }) === 0 && done(() => { el.title = 'Lap'; }) === 1 && done(() => { el.title = 3; el.title = '3'; }) === 1);
  const c = new HTMLElement_();
  say('class: the same class name is left out, another is written', done(() => { c.className = 'row ok'; }) === 1 && done(() => { c.className = 'row ok'; }) === 0 && done(() => { c.className = 'row warn'; }) === 1); }

for (const [name, K] of [['button', HTMLButtonElement_], ['input', HTMLInputElement_], ['select', HTMLSelectElement_], ['textarea', HTMLTextAreaElement_]]) {
  const el = new K();
  say(`disabled (${name}): the same is left out, a change is written, any truthy value counts as true`, done(() => { el.disabled = false; }) === 0 && done(() => { el.disabled = true; }) === 1 && done(() => { el.disabled = true; }) === 0 && done(() => { el.disabled = 1; el.disabled = 'yes'; }) === 0 && done(() => { el.disabled = 0; }) === 1 && el.disabled === false);
}

{ const el = new HTMLElement_();
  say('attribute: a first value is written; the same value again is left out; another value is written', done(() => { el.setAttribute('aria-pressed', 'false'); }) === 1 && done(() => { el.setAttribute('aria-pressed', 'false'); }) === 0 && done(() => { el.setAttribute('aria-pressed', 'true'); }) === 1 && el.getAttribute('aria-pressed') === 'true');
  say('attribute: a number or a boolean is compared as text (5 over "5", true over "true")', done(() => { el.setAttribute('data-n', '5'); el.setAttribute('data-n', 5); el.setAttribute('aria-pressed', true); }) === 1);
  say('attribute: another attribute is its own (aria-pressed true does not hide a data-active false)', done(() => { el.setAttribute('data-active', 'false'); }) === 1); }

{ const s = new CSSStyleDeclaration_();
  say('style property: a first value is written; the same again is left out; another is written', done(() => { s.setProperty('--wf', '0.35'); }) === 1 && done(() => { s.setProperty('--wf', '0.35'); }) === 0 && done(() => { s.setProperty('--wf', '0.5'); }) === 1);
  say('style property: the same value with another priority is written (important)', done(() => { s.setProperty('--wf', '0.5', 'important'); }) === 1 && done(() => { s.setProperty('--wf', '0.5', 'important'); }) === 0 && done(() => { s.setProperty('--wf', '0.5'); }) === 1);
  say('style property: null takes the property out (written), and a property that was never set is not "the same" as an empty text', done(() => { s.setProperty('--wf', null); }) === 1 && done(() => { s.setProperty('--other', null); }) === 1); }

{ // a check that fails must never keep a write from happening
  const bad = new HTMLElement_(); bad.getAttribute = () => { throw new Error('no'); };
  say('when the check itself fails, the write is done as always', done(() => { bad.setAttribute('a', '1'); }) === 1);
  say('install with nothing, or with a window that has no classes, does nothing and does not fail', Quiet.install(null) === 0 && Quiet.install({}) === 0 && Quiet.install({ Node: {} }) === 0); }

{ // a window whose classes can not be changed
  const frozen = {}; Object.defineProperty(frozen, 'Element', { get() { throw new Error('locked'); } });
  let r; try { r = Quiet.install(frozen); } catch (x) { r = 'threw'; }
  say('a window that refuses the change leaves the page to write as always (install does not throw)', r === 0); }

// ---- the edges (found by breaking the guard on purpose) ----
{ const t = Object.assign(new Node_(3), { data: 'q' });
  say('text: "" on a text node itself empties it (a text node has no children, so it is not "already empty")', done(() => { t.textContent = ''; }) === 1 && t.data === '');
  const ab = new HTMLElement_(); ab.childNodes = [Object.assign(new Node_(3), { data: 'ab' }), Object.assign(new Node_(3), { data: 'cd' })];
  say('text: two text nodes whose first one is the text asked for are still written ("ab" over "ab" + "cd")', done(() => { ab.textContent = 'ab'; }) === 1 && ab.childNodes.length === 1 && ab.textContent === 'ab');
  const cm = new HTMLElement_(); cm.childNodes = [Object.assign(new Node_(8), { data: 'x' })];
  say('text: an element whose only child is a comment with that text is written (a comment is not a text)', done(() => { cm.textContent = 'x'; }) === 1 && cm.childNodes[0].nodeType === 3);
  say('class: a class that is not a text (the class of a drawing is an object) is never "the same"', Quiet.SAME.className({ className: {} }, 'x') === false && Quiet.SAME.className({ className: {} }, '[object Object]') === false);
  const th = new HTMLElement_(); Object.defineProperty(th, 'firstChild', { get() { throw new Error('no'); } });
  say('text: when the check fails the write is done as always', done(() => { th.textContent = 'a'; }) === 1);
  const s = new CSSStyleDeclaration_(); s.setProperty('--n', 'null');
  say('style property: null takes away a property whose value is the word null (written, not "the same")', done(() => { s.setProperty('--n', null); }) === 1 && s.getPropertyValue('--n') === ''); }

// ---- on the page: it puts itself in place (only in a window with classes and a document) ----
{ const vm = require('vm'), code = fs.readFileSync(R + 'renderer/quiet.js', 'utf8');
  const page = withDocument => {
    let n = 0; const ctx = vm.createContext({}); ctx.window = ctx; if (withDocument) ctx.document = {};
    ctx.Node = class { constructor() { this.nodeType = 1; this.firstChild = null; } get textContent() { return ''; } set textContent(v) { n++; } };
    vm.runInContext(code, ctx);
    const el = new ctx.Node(); el.textContent = ''; el.textContent = '';
    return { writes: n, Quiet: ctx.Quiet };
  };
  const a = page(true), b = page(false);
  say('on a page (a window with a document) quiet.js is on by itself: an empty element given "" twice is not written', a.writes === 0 && a.Quiet.skipped() === 2);
  say('...and without a document it does not touch anything (but the module is there)', b.writes === 2 && b.Quiet.skipped() === 0 && typeof b.Quiet.install === 'function'); }

// ---- the page loads it first ----
{ const html = fs.readFileSync(R + 'renderer/index.html', 'utf8'), tags = html.match(/<script src="[^"]+"><\/script>/g) || [];
  const at = n => tags.findIndex(t => t.includes('"' + n + '"'));
  say('index.html loads quiet.js, right after webapi.js and before every other script of the app', at('webapi.js') === 0 && at('quiet.js') === 1 && at('listnum.js') === 2); }

// ---- a widget whose text changes is not given the same colours again ----
{ const LiveCanvas = require(R + 'renderer/canvas.js');
  let out = { html: '1', color: '', bg: '' }, styleCalls = 0, solid = 0;
  globalThis.Timing = { content: () => out };
  globalThis.Widgets = { U: 1000 };
  globalThis.Frame = { style: () => { styleCalls++; return { background: 'x' }; }, solidity: () => { solid++; return 1; } };
  const sets = []; const style = new Proxy({}, { set: (t, k, v) => { sets.push(k); t[k] = v; return true; }, get: (t, k) => (k === 'setProperty' ? (a, b) => { sets.push(a); t[a] = b; } : t[k]) });
  const n = { w: {}, layout: {}, el: { style }, val: { innerHTML: '' }, base: {}, last: null };
  const paint = () => LiveCanvas.paint([n], {});
  paint();
  say('the first paint gives the widget its colours (colour, background, border, solidity)', styleCalls === 1 && solid === 1 && sets.includes('color') && sets.includes('--wf') && n.val.innerHTML === '1');
  sets.length = 0; out = { html: '2', color: '', bg: '' }; paint();
  say('the text changes ten times a second but the colours do not: the new text is drawn, the colours are not written again', n.val.innerHTML === '2' && styleCalls === 1 && solid === 1 && sets.length === 0);
  out = { html: '2', color: '', bg: '' }; paint(); out = { html: '2', color: '', bg: '' }; paint();
  say('nothing changed at all: nothing is written', styleCalls === 1 && n.val.innerHTML === '2');
  out = { html: '2', color: '', bg: '#ffd400' }; paint();
  say('the background changes (a flag): the colours are written again, once', styleCalls === 2 && solid === 2);
  out = { html: '2', color: '#fff', bg: '#ffd400' }; paint();
  say('...and so does the text colour', styleCalls === 3);
  out = { html: '3', color: '#fff', bg: '#ffd400' }; paint(); out = { html: '4', color: '#fff', bg: '#ffd400' }; paint();
  say('...and then the same colours are left alone again while the text goes on changing', styleCalls === 3 && n.val.innerHTML === '4');
  out = { html: '4', color: '', bg: '' }; paint();
  say('back to the first colours: they are written again (the last colours are kept, not the first)', styleCalls === 4);
  delete globalThis.Timing; delete globalThis.Widgets; delete globalThis.Frame; }

console.log(fails ? `\n${fails} FAILED` : '\nquiet PASSED');
process.exit(fails ? 1 : 0);
