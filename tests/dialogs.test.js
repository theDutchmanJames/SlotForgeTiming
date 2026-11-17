'use strict';
// renderer/dialogs.js: the app's own confirm and alert. With a page: a modal <dialog>, one at a time, named buttons, Escape cancels,
// Cancel has the focus for a dangerous action. Without one (node tests): the browser's own confirm()/alert(), which tests replace.
const { test } = require('node:test'),
  assert = require('node:assert/strict');

test('without a page the stand-ins answer, through a Promise', async () => {
  const seen = [];
  globalThis.confirm = m => (seen.push(['confirm', m]), false);
  globalThis.alert = m => seen.push(['alert', m]);
  delete require.cache[require.resolve('../renderer/dialogs.js')];
  const D = require('../renderer/dialogs.js');
  assert.equal(await D.confirm('Delete it?', { danger: true }), false);
  globalThis.confirm = () => true;
  assert.equal(await D.confirm('Again?'), true);
  assert.equal(await D.alert('Done.'), undefined);
  assert.deepEqual(seen, [['confirm', 'Delete it?'], ['alert', 'Done.']]);
  delete globalThis.confirm;
  delete globalThis.alert;
});

// a small stand-in page with <dialog>: enough to see what the module builds and how it answers
function page() {
  const made = [];
  class El {
    constructor(tag) {
      Object.assign(this, { tag, children: [], attrs: {}, listeners: {}, className: '', textContent: '', isConnected: true, open: false });
    }
    append(...c) {
      this.children.push(...c);
    }
    appendChild(c) {
      this.children.push(c);
      return c;
    }
    setAttribute(k, v) {
      this.attrs[k] = v;
    }
    addEventListener(t, f) {
      this.listeners[t] = f;
    }
    focus() {
      doc.activeElement = this;
    }
    showModal() {
      this.open = true;
    }
    close() {
      this.open = false;
    }
    remove() {
      this.isConnected = false;
    }
    get text() {
      return [this.textContent, ...this.children.map(c => (c.text !== undefined ? c.text : ''))].join(' ').trim();
    }
  }
  const doc = {
    activeElement: null,
    body: new El('body'),
    createElement: t => {
      const e = new El(t);
      made.push(e);
      return e;
    },
    createDocumentFragment: () => new El('#fragment'),
    createTextNode: t => ({ text: t }),
    querySelectorAll: () => made.filter(e => e.tag === 'dialog' && e.open)
  };
  return { doc, made, El };
}

test('with a page: named buttons, focus on Cancel for a dangerous action, one dialog at a time, Escape cancels', async () => {
  const { doc, made, El } = page();
  globalThis.document = doc;
  globalThis.HTMLDialogElement = El;
  delete require.cache[require.resolve('../renderer/dialogs.js')];
  const D = require('../renderer/dialogs.js');
  const first = D.confirm('Delete the driver?\n\nLaps stay.', { ok: 'Delete', danger: true }),
    second = D.alert('Saved.');
  await new Promise(r => setTimeout(r, 0));
  const dialogs = () => made.filter(e => e.tag === 'dialog');
  assert.equal(dialogs().length, 1, 'the second waits for the first');
  const d = dialogs()[0],
    buttons = made.filter(e => e.tag === 'button');
  assert.match(d.className, /appdlg-danger/);
  const shown = made.find(e => /appdlg-buttons/.test(e.className)).children; // (the buttons as the dialog shows them)
  assert.deepEqual(
    shown.map(b => b.textContent),
    ['Cancel', 'Delete']
  );
  assert.equal(doc.activeElement, shown[0], 'Cancel has the focus for a dangerous action');
  assert.equal(buttons.length, 2);
  assert.match(d.text, /Delete the driver\?/);
  assert.match(d.text, /Laps stay\./);
  d.listeners.cancel({ preventDefault() {} }); // Escape
  assert.equal(await first, false);
  await new Promise(r => setTimeout(r, 0));
  assert.equal(dialogs().length, 2, 'now the second one opens');
  const ok = made.filter(e => e.tag === 'button').pop();
  assert.equal(ok.textContent, 'OK');
  ok.onclick();
  assert.equal(await second, undefined);
  delete globalThis.document;
  delete globalThis.HTMLDialogElement;
});

test('index.html loads dialogs.js before the screens, and screen tests get it too', () => {
  const { order, expand } = require('./renderer-scripts.cjs');
  assert(order.indexOf('dialogs.js') >= 0 && order.indexOf('dialogs.js') < order.indexOf('landing.js') && order.indexOf('dialogs.js') < order.indexOf('race.js'));
  assert.equal(expand(['listnum.js'])[0], 'dialogs.js');
});
