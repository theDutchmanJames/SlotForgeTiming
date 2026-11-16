'use strict';
// Some tests check how the app's code is wired (that a handler calls the right thing, that markup contains an element).
// Such checks compare code with the spacing and quote style removed, so formatting the code, or moving a part of a
// renderer file into renderer/<name>/ (see renderer-scripts.cjs), does not break them.
//   const { code, has } = require('./source.cjs');
//   has(code('renderer/race.js'), "if (live) Sound.stop();")      -> true however the code is laid out
//   flat(text)                                                      -> the text without spaces and with ' for every "
const fs = require('node:fs'),
  path = require('node:path'),
  { order } = require('./renderer-scripts.cjs');
const root = path.join(__dirname, '..');
// a file's source; a renderer file includes its parts in renderer/<name>/ in index.html order
const code = rel => {
  const parts = rel.startsWith('renderer/')
    ? order.filter(s => s.startsWith(rel.slice('renderer/'.length).replace(/\.js$/, '') + '/'))
    : [];
  return [...parts.map(p => 'renderer/' + p), rel].map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
};
const flat = s => String(s).replace(/\s+/g, '').replace(/"/g, "'");
const has = (text, snippet) => flat(text).includes(flat(snippet));
module.exports = { code, flat, has, root };
