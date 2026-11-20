'use strict';
// (2.4.0 review) the same text as the saved JSON: a key whose value is undefined is left out, undefined in a list is null and a date is
// its ISO text, so a value hashes the same before and after it was saved (plain JSON values hash as before)
const canonical = v =>
  Array.isArray(v)
    ? '[' + v.map(x => (x === undefined ? 'null' : canonical(x))).join(',') + ']'
    : v instanceof Date
      ? JSON.stringify(v)
      : v && typeof v === 'object'
        ? '{' +
          Object.keys(v)
            .sort()
            .flatMap(k => {
              const x = v[k]; // (read once: a value can be a getter)
              return x === undefined ? [] : [JSON.stringify(k) + ':' + canonical(x)];
            })
            .join(',') +
          '}'
        : JSON.stringify(v);
module.exports = v => require('node:crypto').createHash('sha256').update(canonical(v)).digest('hex');
