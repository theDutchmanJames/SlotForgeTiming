// The line pictures of the tabs and the Live Race tiles (renderer/icons.js)
const I = require('../renderer/icons.js');
let fails = 0; const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };

const ids = Object.keys(I.PATHS);
const TILES = ['timing', 'board', 'driver', 'database', 'rules', 'director', 'tokens'], NEW = ['home', 'setup', 'custom', 'settings'], BUTTONS = ['pdf'], STARTCARD = ['car', 'check', 'alert', 'chevron', 'pin'], SETUPPAGE = ['layers', 'plus'], SETUPTABS = ['racesetups', 'penalty', 'damage', 'tyre', 'weather', 'rotation', 'fuel', 'balance', 'safetycar', 'pushsave', 'championship'];

ok('the seven pictures of the Live Race tiles are there, the four for the tabs that had none, the one for the Export to PDF button, the eight for the Race Setup sub-tabs (1.45.0) the Safety Car one (1.53.0) and the Push and Save one (1.54.0) and the Championships one (1.55.0) and the five of the Start a race card (1.58.0: a car, a tick, a warning mark, a little arrow, a pin) and the two of the Race Setups page (1.69.0: the pile of layers of the heats, and the plus of Start from a kind): thirty in all', ids.length === 30 && [...TILES, ...NEW, ...BUTTONS, ...SETUPTABS, ...STARTCARD, ...SETUPPAGE].every(id => I.has(id)));
ok('has() is true for a picture and false for anything else (also for names every object has)', I.has('home') && !I.has('') && !I.has('nope') && !I.has(undefined) && !I.has(null) && !I.has('constructor') && !I.has('toString') && !I.has('__proto__') && !I.has('hasOwnProperty'));
ok('an unknown name gives no picture at all, not an empty frame', ['nope', '', undefined, 'constructor', '__proto__'].every(n => I.svg(n) === ''));

// the pictures are put into the page as text, so they may hold nothing but lines and circles
const tags = id => [...I.PATHS[id].matchAll(/<\/?([a-z]+)/gi)].map(m => m[1]);
ok('each picture is made of paths and circles only (nothing that could run or load anything)', ids.every(id => tags(id).length > 0 && tags(id).every(t => t === 'path' || t === 'circle')) && ids.every(id => !/script|on\w+=|href|style|url\(|javascript/i.test(I.PATHS[id])));
ok('...each element closes itself, and every path has a drawing in it', ids.every(id => (I.PATHS[id].match(/<(path|circle)\b[^>]*\/>/g) || []).join('') === I.PATHS[id] && (I.PATHS[id].match(/<path d="[^"]*[0-9][^"]*"\/>/g) || []).length === (I.PATHS[id].match(/<path/g) || []).length));
ok('...and the path text holds only drawing commands and numbers', ids.every(id => [...I.PATHS[id].matchAll(/ d="([^"]*)"/g)].every(m => /^[MmLlHhVvCcSsQqTtAaZz0-9.,\- ]+$/.test(m[1]))));
ok('every circle lies inside the 24 by 24 drawing', ids.every(id => [...I.PATHS[id].matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"\/>/g)].every(([, x, y, r]) => +x - +r >= 0 && +x + +r <= 24 && +y - +r >= 0 && +y + +r <= 24)));

// the picture itself: the same frame for all of them
const frame = (id, o) => I.svg(id, o).replace(I.PATHS[id], '…');
ok('the frame of a picture: 24 by 24, a thin round line in the colour of the text around it, no fill, hidden from screen readers', frame('home') === '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">…</svg>');
ok('the Live Race tile picture is exactly what the tile had before: 40 pixels, class lv-ico, line 1.6', frame('timing', { size: 40, cls: 'lv-ico' }) === '<svg class="lv-ico" viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">…</svg>');
ok('size and line thickness can be chosen (the size in whole pixels)', /width="18" height="18"/.test(I.svg('gear' in I.PATHS ? 'gear' : 'settings', { size: 18 })) && /width="20" height="20"/.test(I.svg('home', { size: 19.6 })) && /stroke-width="2"/.test(I.svg('home', { stroke: 2 })));
ok('...and an unusable size or thickness falls back to 24 and 1.6', ['x', 0, -0, NaN, null, undefined, {}].every(v => /width="24" height="24"/.test(I.svg('home', { size: v })) && /stroke-width="1.6"/.test(I.svg('home', { stroke: v }))));
ok('the class can be chosen, but nothing that would leave the quotes of the attribute gets through', /^<svg class="tabico" /.test(I.svg('home', { cls: 'tabico' })) && !I.svg('home', { cls: 'a" onload="x' }).includes('onload="') && /^<svg class="[\w -]*" viewBox="0 0 24 24"/.test(I.svg('home', { cls: '"><script>' })) && !I.svg('home', { cls: '"><script>' }).includes('<script') && !I.svg('home', {}).includes('class='));
ok('the colour is never part of a picture: it is whatever colour the page gives it', ids.every(id => !/#[0-9a-f]{3}/i.test(I.svg(id)) && I.svg(id).includes('stroke="currentColor"') && I.svg(id).includes('fill="none"')));
ok('every picture is different from every other one', new Set(ids.map(id => I.PATHS[id])).size === ids.length);
ok('the picture of the Live Race tile for a name does not change when it is asked for twice (no shared state)', ids.every(id => I.svg(id, { size: 18 }) === I.svg(id, { size: 18 })));

// 1.2.0: the winner's cup
ok('the winner\'s cup is a small picture with its own gold colours (not the colour of the text), a title for hover and screen readers, and a size', (() => { const t = I.trophy({ size: 20 }); return t.startsWith('<svg class="trophy" viewBox="0 0 24 24" width="20" height="20" role="img" aria-label="Winner"><title>Winner</title>') && t.includes('#f5b800') && !t.includes('currentColor') && t.endsWith('</svg>'); })());
ok('...16 pixels when no size or a wrong size is given, and it is not one of the line pictures', ['x', 0, NaN, null, undefined].every(v => /width="16" height="16"/.test(I.trophy({ size: v }))) && /width="16"/.test(I.trophy()) && !I.has('trophy'));

console.log(fails ? fails + ' ICON TESTS FAILED' : 'ALL ICON TESTS PASSED'); process.exit(fails ? 1 : 0);
