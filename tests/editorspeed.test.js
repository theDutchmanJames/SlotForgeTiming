'use strict';
// 2.4.0: the Layout Editor was slow with a big layout and the sample race lagged. Opening a layout read the canvas height after every widget's
// lane label moved (a new layout of the page per widget); fitting a widget measured it after the last one's fit; and every frame of the sample race
// fitted every widget whose numbers moved. Now: the height is read once, all boxes are measured before any fit, a widget on a canvas is laid out on
// its own (contain), and a frame where only the numbers moved writes the new numbers into the widget as it stands, without a new fit.
const test = require('node:test'),
  assert = require('node:assert/strict');
const { code, has } = require('./source.cjs');
const LT = require('../renderer/layouttry.js');

// a small stand-in for the page: elements, text, a template that reads simple markup, and a walker over elements and text
function node(type, props) {
  return { nodeType: type, childNodes: [], attributes: [], ...props };
}
function parse(html, doc) {
  const root = node(11, { ownerDocument: doc }),
    stack = [root];
  for (const m of html.matchAll(/<(\/?)(\w+)([^>]*)>|([^<]+)/g)) {
    const top = stack[stack.length - 1];
    if (m[4] !== undefined) top.childNodes.push(node(3, { nodeName: '#text', data: m[4] }));
    else if (m[1]) stack.pop();
    else {
      const attrs = [...m[3].matchAll(/(\w[\w-]*)="([^"]*)"/g)].map(a => ({ name: a[1], value: a[2] }));
      const el = node(1, {
        nodeName: m[2].toUpperCase(),
        attributes: attrs,
        getAttribute(n) {
          const a = this.attributes.find(x => x.name === n);
          return a ? a.value : null;
        },
        setAttribute(n, v) {
          const a = this.attributes.find(x => x.name === n);
          if (a) a.value = v;
          else this.attributes.push({ name: n, value: v });
        }
      });
      top.childNodes.push(el);
      stack.push(el);
    }
  }
  return root;
}
const doc = {
  createElement: () => ({
    set innerHTML(h) {
      this.content = parse(h, doc);
    }
  }),
  createTreeWalker(root) {
    const list = [];
    const walk = n => n.childNodes.forEach(c => (list.push(c), walk(c)));
    walk(root);
    let i = -1;
    return { nextNode: () => list[++i] || null };
  }
};
const live = html => Object.assign(parse(html, doc), { ownerDocument: doc });
const texts = n => n.childNodes.map(c => (c.nodeType === 3 ? c.data : texts(c))).join('');

test('only the numbers moved: they are written into the widget as it stands, and the sizes a fit set are kept', () => {
  const last = '<div class="aio-box"><b>Lap 3</b> <span data-p="42">9.734</span></div>',
    next = '<div class="aio-box"><b>Lap 4</b> <span data-p="47">9.559</span></div>';
  const val = live(last);
  const box = val.childNodes[0];
  box.attributes.push({ name: 'style', value: '--aio-primary:31px' }); // (set by the last fit)
  assert.equal(LT.patchDigits(val, last, next), true);
  assert.equal(texts(val), 'Lap 4 9.559');
  assert.equal(box.getAttribute('style'), '--aio-primary:31px', 'the fit is kept');
  assert.equal(box.childNodes[2].getAttribute('data-p'), '47', 'a number in an attribute follows too');
});

test('anything but the numbers changed: drawn and fitted afresh', () => {
  const last = '<b>Lap 9</b>';
  assert.equal(LT.patchDigits(live(last), last, '<b>Lap 10</b>'), false, 'one digit more');
  assert.equal(LT.patchDigits(live(last), last, '<i>Lap 9</i>'), false, 'another tag');
  assert.equal(LT.patchDigits(live('<b>Lap 9</b><i>x</i>'), last, '<b>Lap 8</b>'), false, 'the widget is not what was drawn');
  assert.equal(LT.patchDigits(live(last), undefined, '<b>Lap 8</b>'), false, 'nothing drawn yet');
});

test('a frame of the sample race fits again only the widgets whose shape or colour changed', () => {
  const L = code('renderer/layouttry.js');
  assert.ok(has(L, 'if (sameLook && patchDigits(val, last, html) && fitHolds(val, w)) return;'));
  assert.ok(has(L, "look = o ? [o.color, o.bg, o.disabled].join('|') : '';"), 'a colour change (a car in the pits) is painted');
});

test('the editor reads the canvas height once, and measures every widget before it fits any', () => {
  const EC = code('renderer/editorcanvas.js');
  assert.ok(has(EC, '* height() < 20;'));
  assert.ok(!has(EC, '* canvas.clientHeight < 20;'));
  const E = code('renderer/editor.js');
  assert.ok(
    has(E, 'for (const el of list) el._sfBox = { width: el.getBoundingClientRect().width, cw: el.clientWidth, ch: el.clientHeight };')
  );
  assert.ok(has(code('renderer/frame.js'), 'const box = el._sfBox ||'));
  assert.ok(/\.canvas>\.lw\{contain:size layout style\}/.test(code('renderer/styles.css')));
});
