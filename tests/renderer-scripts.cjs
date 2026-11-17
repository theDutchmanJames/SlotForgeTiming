'use strict';
// The renderer's scripts as renderer/index.html loads them. Screen tests name the scripts they need ('engine.js', ...);
// expand() puts in front of each one the parts that index.html loads from the folder of the same name (renderer/engine/ for
// engine.js), so a file split into parts needs no change in the tests that use it.
const fs = require('node:fs'),
  path = require('node:path');
const order = [...fs.readFileSync(path.join(__dirname, '..', 'renderer', 'index.html'), 'utf8').matchAll(/<script src="([^"]+)"/g)].map(
  m => m[1]
);
// dialogs.js (the app's own confirm and alert) is loaded early by every page, so it comes first unless the list names it
const ALWAYS = ['dialogs.js'];
const expand = list => [
  ...ALWAYS.filter(f => order.includes(f) && !list.includes(f)),
  ...list.flatMap(f => {
    const dir = f.replace(/\.js$/, '') + '/';
    return [...order.filter(s => s.startsWith(dir)), f];
  })
];
module.exports = { order, expand };
