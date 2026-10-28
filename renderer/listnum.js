// Numbers typed as a list: "1, 2.5, 5" - separated by commas, semicolons or spaces. Pure, so it runs in the tests too.
// The owner of this app (and many of its users) writes a decimal comma: "0,5" is half a second. A comma is a decimal comma when
//  - it sits between two digits ("2,5") in a list that is separated by spaces or semicolons ("0,5 1 2,5", or "0,5, 1, 2,5" with commas and spaces), or
//  - the number is "0,5" and so on: a list never has a 0 in it, so it can only mean 0.5.
// A list typed without spaces ("1,3,10") stays a list of 1, 3 and 10.
(function (root) {
  'use strict';
  // the numbers of the text as text, with a dot for the decimals: "0,5, 1, 2,5" -> ['0.5', '1', '2.5']
  function items(text) {
    const parts = String(text === undefined || text === null ? '' : text).split(/[\s;]+/).filter(Boolean), spaced = parts.length > 1, out = [];
    parts.forEach(part => {
      const p = part.replace(/^,+|,+$/g, '');
      if (/^\d+,\d+$/.test(p) && (spaced || /^0,/.test(p))) out.push(p.replace(',', '.'));
      else p.split(',').filter(Boolean).forEach(x => out.push(x));
    });
    return out;
  }
  const numbers = text => items(text).map(Number);
  // the text with the decimal commas made dots and one ", " between the numbers. A list that has no decimal comma, and text that is not a list of plain numbers, is given back as it is.
  function tidy(text) {
    const list = items(text), plain = String(text === undefined || text === null ? '' : text).split(/[\s;,]+/).filter(Boolean);
    if (list.length === plain.length && list.every((x, i) => x === plain[i])) return text;
    return list.length && list.every(x => /^\d+(\.\d+)?$/.test(x)) ? list.join(', ') : text;
  }
  const api = { items, numbers, tidy };
  root.ListNum = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
