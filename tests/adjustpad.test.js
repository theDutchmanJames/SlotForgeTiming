// 1.12.0: the adjust pads - [+] value [−] for penalty points, time, laps and championship points. The rules, the colours, the markup, the click and Undo (renderer/adjustpad.js),
// and the places that use them: the style sheet, the App Settings page, the page list.
const fs = require('fs'), path = require('path');
const A = require('../renderer/adjustpad.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

// ---- the groups ----
ok('four groups, in this order: penalty points, time, laps, championship points', A.GROUPS.map(g => g.id).join() === 'points,time,laps,champ');
ok('...each with a title, a setting of its own and standard values', A.GROUPS.every(g => g.title && /^pad[A-Z]/.test(g.key) && g.defaults.length > 0 && new Set(A.GROUPS.map(x => x.key)).size === 4));
ok('...the standard values', A.valuesOf({}, 'points').join() === '1,2,5' && A.valuesOf({}, 'time').join() === '5,10,30' && A.valuesOf({}, 'laps').join() === '1,2' && A.valuesOf({}, 'champ').join() === '1,2,5');
ok('an unknown group has no values and no look', A.valuesOf({}, 'nope').length === 0 && A.look('nope') === null && A.byId('nope') === null && A.html({ group: 'nope' }) === '');

// ---- the lists ----
ok('a list is sorted, without doubles and without what is not a positive number', A.clean('time', [30, 5, 10, 10, 'x', -2, 0, null, NaN, Infinity]).join() === '5,10,30');
ok('...it can come as text: commas, spaces or semicolons between the numbers', A.clean('time', '5, 10;30  15').join() === '5,10,15,30' && A.clean('champ', '1,2,5').join() === '1,2,5');
ok('...decimals: time keeps three, championship points two, penalty points and laps are whole numbers', A.clean('time', '0.5 1.2345').join() === '0.5,1.235' && A.clean('champ', '0.5 1.234').join() === '0.5,1.23' && A.clean('points', '1.6 3').join() === '2,3' && A.clean('laps', '0.2 4').join() === '4');
ok('...at most six values (the smallest six)', A.clean('time', '1 2 3 4 5 6 7 8').join() === '1,2,3,4,5,6' && A.MAXV === 6);
ok('...nothing usable gives the standard list', A.clean('time', '').join() === '5,10,30' && A.clean('laps', 'abc').join() === '1,2' && A.clean('points', null).join() === '1,2,5' && A.clean('champ', {}).join() === '1,2,5' && A.clean('time', 7).join() === '5,10,30');
ok('...a value that is far too big is refused', A.clean('time', '5 999999999').join() === '5');
ok('the settings: the list of the group is read from its key, and cleaned', A.valuesOf({ padSeconds: [3, 1] }, 'time').join() === '1,3' && A.valuesOf({ padLaps: 'x' }, 'laps').join() === '1,2' && A.valuesOf(null, 'laps').join() === '1,2');
ok('the text of a list: 1, 2.5, 5', A.listText([1, 2.5, 5]) === '1, 2.5, 5' && A.parse('1, 2.5 5').join() === '1,2.5,5' && A.parse(null).length === 0);
ok('an amount: positive, with the decimals of the group, as a number or as text', A.amount(A.byId('time'), '2.5') === 2.5 && A.amount(A.byId('laps'), '1.4') === 1 && A.amount(A.byId('laps'), 0.4) === null && A.amount(A.byId('time'), '') === null && A.amount(A.byId('time'), -1) === null && A.amount(A.byId('time'), 'abc') === null && A.amount(A.byId('time'), true) === null && A.amount(A.byId('time'), [5]) === null);
ok('the layout: horizontal unless the setting says vertical', A.layoutOf({}) === 'h' && A.layoutOf({ padLayout: 'v' }) === 'v' && A.layoutOf({ padLayout: 'x' }) === 'h' && A.layoutOf(null) === 'h');
ok('the signature changes with the layout and with a list, and not with anything else', A.signature({}) === A.signature({ theme: 'dark' }) && A.signature({}) !== A.signature({ padLayout: 'v' }) && A.signature({}) !== A.signature({ padLaps: [3] }) && A.signature({ padLaps: [2, 1] }) === A.signature({ padLaps: [1, 2] }));

// ---- the colours ----
const hsl = h => { const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), L = (mx + mn) / 2, d = mx - mn; return { L, S: d === 0 ? 0 : d / (1 - Math.abs(2 * L - 1)) }; };
ok('penalty points are yellow, time orange, laps violet and championship points green', A.look('points').plus === '#f2b705' && A.look('time').plus === '#f08a24' && A.look('laps').plus === '#9b7bff' && A.look('champ').plus === '#3fb950');
ok('the colours follow the folders of the Race Director page (yellow and red)', R('renderer/styles.css').includes('.dir-yellow{--fc:#f2b705}') && A.look('points').plus === '#f2b705');
ok('the minus button is the same colour, darker and less coloured than the plus button (in every group)', A.GROUPS.every(g => { const l = A.look(g.id); return A.lum(l.minus) < A.lum(l.plus) && hsl(l.minus).S < hsl(l.plus).S && hsl(l.minus).L < hsl(l.plus).L; }));
ok('...but not grey: it is still recognisably the same hue family (the minus buttons of two groups differ)', new Set(A.GROUPS.map(g => A.look(g.id).minus)).size === 4);
ok('the letters on every button can be read (contrast of at least 4.4 to 1), dark on light and white on dark', A.GROUPS.every(g => { const l = A.look(g.id); return A.contrast(l.plus, l.plusText) >= 4.4 && A.contrast(l.minus, l.minusText) >= 4.4; }) && A.look('points').plusText === '#111418');
ok('the colours go on the pad as variables', A.styleOf('time') === `--pc:#f08a24;--pt:${A.look('time').plusText};--mc:${A.look('time').minus};--mt:${A.look('time').minusText}`);

// ---- the words ----
ok('an amount in words: seconds as "s", the others singular or plural', A.unitText('time', 10) === '10 s' && A.unitText('time', 2.5) === '2.5 s' && A.unitText('laps', 1) === '1 lap' && A.unitText('laps', 2) === '2 laps' && A.unitText('points', 1) === '1 penalty point' && A.unitText('points', 5) === '5 penalty points' && A.unitText('champ', 2) === '2 championship points');
ok('what was done: + to the driver, a real minus sign from the driver', A.describe('time', 10, 'Sam') === '+10 s to Sam' && A.describe('time', -10, 'Sam') === '−10 s from Sam' && A.describe('laps', 1, 'Kim') === '+1 lap to Kim' && A.describe('points', -2, 'Kim') === '−2 penalty points from Kim');
ok('...nothing for zero, text or an unknown group', A.describe('time', 0, 'x') === '' && A.describe('time', NaN, 'x') === '' && A.describe('nope', 1, 'x') === '');

// ---- the markup of a pad ----
const cnt = (h, re) => (h.match(re) || []).length;
let h = A.html({ group: 'time', values: [5, 10, 30], layout: 'h' });
ok('a pad has a title, the colours of its group, and one column per value plus one for any other amount', h.includes('data-pad="time"') && h.includes('<strong>Time</strong>') && h.includes(A.styleOf('time')) && h.includes('style="--n:4"') && cnt(h, /class="pad-btn pad-plus"/g) === 4 && cnt(h, /class="pad-btn pad-minus"/g) === 4 && cnt(h, /class="pad-val"/g) === 3 && cnt(h, /class="pad-other"/g) === 1);
ok('horizontal: first all the + buttons, then the values (and the field), then all the − buttons', h.indexOf('pad-plus') < h.indexOf('pad-val') && h.lastIndexOf('pad-plus') < h.indexOf('pad-val') && h.lastIndexOf('pad-val') < h.indexOf('pad-minus') && h.indexOf('pad-other') < h.indexOf('pad-minus') && h.includes('pad-h'));
const hv = A.html({ group: 'time', values: [5, 10, 30], layout: 'v' });
ok('vertical: a row per value, [+] value [−], the field for another amount in the last row', hv.includes('pad-v') && cnt(hv, /class="pad-btn pad-(plus|minus)"/g) === 8 && /pad-plus[^>]*data-v="5"[^>]*>\+<\/button><span class="pad-val">5 s<\/span><button[^>]*pad-minus[^>]*data-v="5"/.test(hv) && /pad-plus[^>]*data-other="1"[^>]*>\+<\/button><input[^>]*pad-other[^>]*><button[^>]*pad-minus[^>]*data-other="1"/.test(hv));
ok('the sign is always on the button: + and a real minus sign, whatever the colour', cnt(h, />\+<\/button>/g) === 4 && cnt(h, />−<\/button>/g) === 4);
ok('every button says what it does for a screen reader ("Add 10 s", "Deduct 10 s"), with the name when it is given', h.includes('aria-label="Add 10 s"') && h.includes('aria-label="Deduct 10 s"') && h.includes('aria-label="Add the other amount"') && A.html({ group: 'laps', who: 'Z<b>' }).includes('aria-label="Add 1 lap for Z&lt;b&gt;"') && !A.html({ group: 'laps', who: 'Z<b>' }).includes('Z<b>'));
ok('the value shows its unit only for seconds', h.includes('<span class="pad-val">10 s</span>') && A.html({ group: 'laps', values: [1] }).includes('<span class="pad-val">1</span>'));
ok('the buttons carry the group, the sign and the value; more attributes can be added to every button (the review adds the car)', h.includes('data-pad-do="time" data-sign="1" data-v="5"') && h.includes('data-pad-do="time" data-sign="-1" data-v="30"') && A.html({ group: 'time', attrs: 'data-rv="adjust" data-car="3"' }).split('data-rv="adjust" data-car="3"').length === 9);
ok('the field for another amount: a number, whole for laps and penalty points, with a name for a screen reader', /<input type="number" class="pad-other" data-pad-other="time" min="0" step="any" placeholder="other" aria-label="Other amount of time">/.test(h) && /data-pad-other="laps" min="0" step="1"/.test(A.html({ group: 'laps' })));
ok('a pad can be switched off or hidden', cnt(A.html({ group: 'laps', disabled: true }), / disabled/g) === 7 && A.html({ group: 'laps', hidden: true }).includes(' hidden>') && !A.html({ group: 'laps' }).includes('disabled'));
ok('without values a pad has the standard ones; a bad layout is horizontal', cnt(A.html({ group: 'time' }), /class="pad-val"/g) === 3 && A.html({ group: 'time', layout: 'x' }).includes('pad-h'));
const all = A.padsHtml({ padLayout: 'v', padSeconds: [2] }, {});
ok('all the pads for the settings: four, in order, in the layout of the settings, with the values of the settings', cnt(all, /<div class="pad pad-v/g) === 4 && all.indexOf('data-pad="points"') < all.indexOf('data-pad="time"') && all.indexOf('data-pad="laps"') < all.indexOf('data-pad="champ"') && all.includes('data-v="2"') && !all.includes('data-pad-do="time" data-sign="1" data-v="5"'));
ok('...some of them only, and some hidden', A.padsHtml({}, { groups: ['time', 'laps'] }).includes('data-pad="laps"') && !A.padsHtml({}, { groups: ['time', 'laps'] }).includes('data-pad="points"') && /data-pad="champ"[^>]*hidden/.test(A.padsHtml({}, { hidden: ['champ'] })) && !/data-pad="time"[^>]*hidden/.test(A.padsHtml({}, { hidden: ['champ'] })));

// ---- a click ----
const btn = (d, typed) => ({ dataset: d, closest: () => ({ querySelector: () => (typed === undefined ? null : { value: typed }) }) });
ok('a + button reads as a positive amount of its group, a − button as a negative one', JSON.stringify(A.read(btn({ padDo: 'time', v: '10', sign: '1' }))) === '{"group":"time","amount":10}' && JSON.stringify(A.read(btn({ padDo: 'laps', v: '2', sign: '-1' }))) === '{"group":"laps","amount":-2}');
ok('the field for another amount is read from the pad of the button', A.read(btn({ padDo: 'time', sign: '-1', other: '1' }, '1.25')).amount === -1.25 && A.read(btn({ padDo: 'laps', sign: '1', other: '1' }, '2.6')).amount === 3 && A.read(btn({ padDo: 'champ', sign: '1', other: '1' }, '0.125')).amount === 0.13);
ok('...or from the place that is given', A.read({ dataset: { padDo: 'time', sign: '1', other: '1' } }, { querySelector: () => ({ value: '4' }) }).amount === 4);
ok('an empty field, zero, a minus sign, text or too much is nothing', ['', '0', '-3', 'abc', ' ', 'Infinity', '1e999', '0.0001'].every(v => A.read(btn({ padDo: 'time', sign: '1', other: '1' }, v)) === null || (v === '0.0001' && false)));
ok('...no field at all, an unknown group, no group, nothing at all', A.read(btn({ padDo: 'time', sign: '1', other: '1' })) === null && A.read(btn({ padDo: 'x', v: '5', sign: '1' })) === null && A.read(btn({ v: '5', sign: '1' })) === null && A.read(null) === null && A.read({}) === null && A.read(btn({ padDo: 'time', sign: '1' })) === null);

// ---- Undo ----
{
  const val = {}; const get = (l, g) => (`${l}:${g}` in val ? val[`${l}:${g}`] : null);
  const h = A.history(5, 1000);
  ok('a new history has nothing to undo and says so', !h.canUndo() && h.undo() === null && h.line() === 'Nothing adjusted yet.' && h.size() === 0);
  val['1:time'] = 0; h.push({ lane: 1, group: 'time', amount: 10, text: '+10 s to Sam', before: 0, at: 0 });
  ok('an action that the race has not shown yet can be seen in the line but not undone (yet)', h.line() === 'Last: +10 s to Sam' && !h.canUndo());
  val['1:time'] = 10; h.settle(get, 100);
  ok('when the numbers show it, it can be undone: the pad command with the opposite amount', h.canUndo() && JSON.stringify(h.undo()) === '{"lane":1,"group":"time","amount":-10}' && h.line() === 'Undone: +10 s to Sam' && !h.canUndo());
  val['0:points'] = 2; h.push({ lane: 0, group: 'points', amount: -5, text: '−5 penalty points from Alex', before: 2, at: 0 });
  val['0:points'] = 0; h.settle(get, 50);
  ok('a deduction that stopped at zero is undone by what was really taken (2, not 5)', h.undo().amount === 2);
  h.push({ lane: 0, group: 'laps', amount: 1, text: 'x', before: 0, at: 0 }); val['0:laps'] = 0; h.settle(get, 900);
  ok('an action that changed nothing is kept for a moment (the race may be slow), and then dropped', h.size() === 1); h.settle(get, 1100);
  ok('...dropped: nothing to undo, nothing in the line', h.size() === 0 && h.line() === 'Nothing adjusted yet.' && !h.canUndo());
  h.push({ lane: 0, group: 'laps', amount: 1, text: 'a', before: 0, at: 0 }); h.push({ lane: 0, group: 'laps', amount: 1, text: 'b', before: 0, at: 10 });
  val['0:laps'] = 2; h.settle(get, 100);
  ok('two presses before the race answers each count for themselves (the second starts where the first ends)', h.undo().amount === -1 && h.undo().amount === -1 && h.undo() === null);
  for (let k = 0; k < 8; k++) { h.push({ lane: 0, group: 'time', amount: 1, text: 't' + k, before: k, at: 0 }); val['0:time'] = k + 1; h.settle(get, 1); }
  ok('only the last five are kept (the limit of this history)', h.size() === 5 && h.line() === 'Last: t7');
  h.push({ lane: 2, group: 'champ', amount: 1, text: 'c', before: 0, at: 0 }); h.clear();
  ok('clear forgets everything (a new race)', h.size() === 0 && h.line() === 'Nothing adjusted yet.');
  val['0:champ'] = 0.5; h.push({ lane: 0, group: 'champ', amount: 2, text: 'c', before: 0, at: 0 });
  h.settle(get, 5); ok('fractions: 0.5 points where 2 were added is a limit, so 0.5 is what is undone', h.undo().amount === -0.5);
}

// ---- the places that use them ----
const css = R('renderer/styles.css'), idx = R('renderer/index.html'), app = R('renderer/app.js'), live = R('renderer/liveview.js'), race = R('renderer/race.js'), rv = R('renderer/review.js');
ok('the style sheet has the pads: grid, plus and minus colours from the variables, a visible focus, a switched off look', /\.pad\{[^}]*border-left:4px solid var\(--pc\)/.test(css) && /\.pad-plus\{background:var\(--pc\);color:var\(--pt\)\}/.test(css) && /\.pad-minus\{background:var\(--mc\);color:var\(--mt\)\}/.test(css) && /\.pad-btn:focus-visible/.test(css) && /\.pad-btn:disabled\{opacity/.test(css) && /\.pad-h \.pad-grid\{grid-template-columns:repeat\(var\(--n\)/.test(css) && /\.pad-v \.pad-grid\{grid-template-columns/.test(css) && /\.pad\[hidden\]\{display:none\}/.test(css));
ok('...the buttons are big enough to hit (at least 44 pixels high)', /\.pad-btn\{[^}]*min-height:4[4-9]px/.test(css));
ok('...championship points are green in the review (a darker green on the light themes)', /\.rv-champ\{color:#3fb950/.test(css) && /\[data-theme="light"\] \.rv-champ[^{]*\{color:#1f7a2e\}/.test(css));
ok('the special penalties and the damage buttons of the Director page have the same look: yellow and red, with the darker and greyer minus (the colours are the ones of the pads)', (() => { const m = c => A.minusOf(c).toLowerCase(), t = c => A.textOn(c);
  return css.includes(`.dir-yellow .btn[data-cmd="penalty"][data-n="1"],.dir-yellow .btn[data-cmd="assign"]{background:#f2b705;color:${t('#f2b705')}`) && css.includes(`.dir-yellow .btn[data-cmd="penalty"][data-n="-1"]{background:${m('#f2b705')};color:${t(m('#f2b705'))}`)
    && css.includes(`.dir-red .btn[data-dm="give"]{background:#e5484d;color:${t('#e5484d')}`) && css.includes(`.dir-red .btn[data-dm="take"]{background:${m('#e5484d')};color:${t(m('#e5484d'))}`); })());
ok('the page loads the pads before the review, and the settings page', idx.indexOf('adjustpad.js') > 0 && idx.indexOf('adjustpad.js') < idx.indexOf('review.js') && idx.indexOf('adjustpad.js') < idx.indexOf('liveview.js') && idx.includes('padui.js'));
ok('App Settings has a Race Director page, after App Theme', /\['theme', 'App Theme'\], \['director', 'Race Director'\]/.test(app) && app.includes("renderPadSettings("));
ok('the race window does the pad commands (and only during the race, not for a Time Token Session)', /pad\(group, lane, amount\)/.test(race) && /cmd\.type === 'pad'\) actions\.pad\(cmd\.group, Number\(cmd\.lane\), Number\(cmd\.amount\)\)/.test(race) && /pad\(group, lane, amount\)[^\n]*\n\s*if \(tokens \|\| !\['running', 'paused'\]/.test(race));
ok('the review draws pads instead of fields (no typed fields with Add and Deduct any more)', rv.includes('AdjustPad.padsHtml') && !rv.includes('data-rva') && !rv.includes('>Deduct<'));
ok('the Director page has the Adjust folder', live.includes("folder('adjust', 'Adjust'") && live.includes('AdjustPad.history()'));

if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
console.log('ALL ADJUST PAD TESTS PASSED');
