const fs = require('fs'), path = require('path');
const T = require('../renderer/theme.js');
let fails = 0; const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };

// the ready-made themes, read from the style sheet (the one place their colours are written down)
const css = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'styles.css'), 'utf8');
const sheet = {}; for (const m of css.matchAll(/^\[data-theme="(\w+)"\]\{([^}]*)\}/gm)) sheet[m[1]] = Object.fromEntries(m[2].split(';').filter(Boolean).map(x => x.split(':')).map(([k, v]) => [k.replace(/^--/, ''), v]));
const builtIn = T.THEMES.filter(t => t[0] !== 'custom').map(t => t[0]);

ok('every theme in the list except Custom has its colours in styles.css', builtIn.length === 8 && builtIn.every(k => sheet[k]) && Object.keys(sheet).length === 8);
ok('...with the six colours and the text colour for the accent', builtIn.every(k => [...T.COLORS.map(c => c[0]), 'on-accent'].every(c => T.hex6(sheet[k][c]))));
// the Live Race tab (a Live on Air sign): its red is the sign's red mixed with the theme's text colour, so it has to read on the panel of every theme
{ const rule = (css.match(/\.tab\.onair\{[^}]*\}/) || [''])[0], mix = /--onair:color-mix\(in srgb,(#[0-9a-f]{6}) (\d+)%,var\(--ink\)\)/.exec(rule);
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), toHex = a => '#' + a.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  const sign = ink => { const r = hex(mix[1]), k = hex(T.hex6(ink)), f = Number(mix[2]) / 100; return toHex(r.map((v, i) => v * f + k[i] * (1 - f))); };
  ok('the Live Race sign takes its red from the style sheet: a red mixed with the text colour of the theme', !!mix && /background:transparent/.test(rule) && /color:var\(--onair\)/.test(rule) && /border:1\.5px solid var\(--onair\)/.test(rule));
  ok('...and that red reads (at least 4.4 to 1, text and outline) on the panel of every ready-made theme, dark or light', !!mix && builtIn.every(k => T.ratio(sign(sheet[k].ink), T.hex6(sheet[k].panel)) >= 4.4));
  ok('...also for plain black and white themes of your own', !!mix && T.ratio(sign('#ffffff'), '#000000') >= 4.4 && T.ratio(sign('#000000'), '#ffffff') >= 4.4 && T.ratio(sign('#111111'), '#ffffff') >= 4.4 && T.ratio(sign('#eeeeee'), '#101010') >= 4.4);
  ok('...and it still looks red, not pink or brown: red leads in every theme', !!mix && builtIn.every(k => { const [r, g, b] = hex(sign(sheet[k].ink)); return r >= 160 && r > g * 2 && r > b * 2; })); }
// the line pictures of the tabs are drawn in the accent colour on the header (which has the colour of the panels)
ok('the accent colour can be seen on the header in every ready-made theme (at least 3 to 1, the minimum for a picture)', builtIn.every(k => T.ratio(T.hex6(sheet[k].accent), T.hex6(sheet[k].panel)) >= 3));
ok('Custom is the last theme in the list, and the default custom colours are those of the Dark theme', T.THEMES[T.THEMES.length - 1][0] === 'custom' && T.COLORS.every(([k]) => T.hex6(sheet.dark[k]) === T.DEFAULT[k]));
ok('no ready-made theme triggers a readability warning (so the warnings mean something)', builtIn.every(k => T.problems(Object.fromEntries(T.COLORS.map(([c]) => [c, T.hex6(sheet[k][c])]))).length === 0));

ok('hex6 accepts #rgb and #rrggbb in any case', T.hex6('#ABC') === '#aabbcc' && T.hex6('#0e1624') === '#0e1624' && T.hex6(' #FFF ') === '#ffffff');
ok('hex6 refuses everything else (nothing from a file reaches the page)', ['', null, undefined, 5, 'red', '#12', '#12345g', '#1234567', 'url(x)', '#fff;background:url(x)', '#fff }', 'var(--bg)'].every(v => T.hex6(v) === ''));
ok('customOf takes the chosen colours, and the Dark colour for any missing or unreadable one', (c => c.bg === '#000000' && c.ink === '#112233' && c.panel === T.DEFAULT.panel && c.accent === T.DEFAULT.accent && Object.keys(c).join() === 'bg,panel,ink,muted,line,accent')(T.customOf({ customColors: { bg: '#000', ink: '#123', panel: 'blue', accent: 7 } })));
ok('customOf copes with no settings at all', JSON.stringify(T.customOf(undefined)) === JSON.stringify(T.DEFAULT) && JSON.stringify(T.customOf({ customColors: 'x' })) === JSON.stringify(T.DEFAULT));

ok('contrast: black on white is 21, a colour on itself is 1', Math.abs(T.ratio('#000000', '#ffffff') - 21) < 1e-9 && T.ratio('#336699', '#336699') === 1 && T.ratio('#ffffff', '#000000') === T.ratio('#000000', '#ffffff'));
ok('the text on the accent is black on light colours and white on dark ones', T.onAccent('#ffd400') === '#000000' && T.onAccent('#ffffff') === '#000000' && T.onAccent('#000000') === '#ffffff' && T.onAccent('#0f4c81') === '#ffffff');
ok('...and for every ready-made accent it is the same choice (white or dark) as the theme makes itself', builtIn.every(k => (T.onAccent(T.hex6(sheet[k].accent)) === '#ffffff') === (T.hex6(sheet[k]['on-accent']) === '#ffffff')));
ok('a set of colours where nothing stands out is warned about three times', T.problems(Object.fromEntries(T.COLORS.map(([k]) => [k, '#777777']))).length === 3);
ok('...and only the problem is named', (w => w.length === 1 && /Text/.test(w[0]))(T.problems({ ...T.DEFAULT, ink: T.DEFAULT.bg, muted: '#ffffff' })) && T.problems({ ...T.DEFAULT, accent: T.DEFAULT.bg }).length === 1);

console.log(fails ? fails + ' THEME TESTS FAILED' : 'ALL THEME TESTS PASSED'); process.exit(fails ? 1 : 0);
