// Soft lift (1.46.0): the Depth setting (renderer/depth.js) and the depth layer of the style sheet (the part "Soft lift" at the end of renderer/styles.css).
const fs = require('fs'), path = require('path');
const D = require('../renderer/depth.js'), T = require('../renderer/theme.js');
let fails = 0; const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const R = path.join(__dirname, '..', 'renderer'), read = f => fs.readFileSync(path.join(R, f), 'utf8');

// ---- the levels
ok('there are four levels: Flat, Soft lift (the standard), Medium, Thick card', D.LEVELS.map(l => l[0]).join() === '0,35,55,75' && /^Flat/.test(D.LEVELS[0][1]) && /^Soft lift.*standard/.test(D.LEVELS[1][1]) && /^Medium/.test(D.LEVELS[2][1]) && /^Thick card/.test(D.LEVELS[3][1]) && D.DEFAULT === 35);
ok('nothing saved yet is the standard (Soft lift)', D.levelOf(undefined) === 35 && D.levelOf(null) === 35 && D.levelOf('') === 35 && D.levelOf('  ') === 35 && D.factorOf(undefined) === 0.35);
ok('every level is kept as it is, also when it was saved as text', D.LEVELS.every(l => D.levelOf(l[0]) === l[0] && D.levelOf(String(l[0])) === l[0]) && D.levelOf(' 55 ') === 55);
ok('Flat (0) is a real choice and is not turned into the standard', D.levelOf(0) === 0 && D.levelOf('0') === 0 && D.factorOf(0) === 0 && D.factorOf('0') === 0);
ok('a level that is not offered becomes the standard', [1, 34, 36, 100, -35, 35.5, 54.9, 76, '35.5', 'thick', NaN, Infinity].every(v => D.levelOf(v) === 35));
ok('...also something that is not a number or a text (false must not become Flat)', [false, true, {}, [], [0], [35], () => 0, Symbol('x')].every(v => D.levelOf(v) === 35));
ok('the factor is the level divided by 100, what the style sheet gets as --depth', D.LEVELS.every(l => D.factorOf(l[0]) === l[0] / 100) && D.factorOf(75) === 0.75 && D.factorOf(35) === 0.35);

// ---- the style sheet
const split = (v, ch) => { const out = []; let depth = 0, cur = ''; for (const c of v) { if (c === '(') depth++; if (c === ')') depth--; if (c === ch && depth === 0) { out.push(cur); cur = ''; } else cur += c; } if (cur.trim()) out.push(cur); return out.map(x => x.trim()); };
const css = read('styles.css'), from = css.indexOf('/* ---- Soft lift (1.46.0)'), layer = from > 0 ? css.slice(from) : '';
ok('the style sheet has the Soft lift part, at the end (so nothing before it can win over it by order)', from > 0 && layer.length > 2000 && css.lastIndexOf('/* ----') === from);
const rules = []; for (const m of layer.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) rules.push({ sel: m[1].trim().replace(/\s+/g, ' '), body: m[2].trim().replace(/\s+/g, ' ') });
const decls = body => split(body, ';').map(x => x.trim()).filter(Boolean).map(x => { const i = x.indexOf(':'); return [x.slice(0, i).trim(), x.slice(i + 1).trim()]; });
ok('the part holds only custom properties, box-shadow and transform: no colour, background, border or size of anything is changed', rules.length >= 13 && rules.every(r => decls(r.body).every(([k]) => k.startsWith('--') || k === 'box-shadow' || k === 'transform')));
ok('...and it never adds a part (no content, no pseudo element, no position)', !/::?(before|after)|content:|position:|background|border|outline|filter/.test(layer.replace(/\/\*[\s\S]*?\*\//g, '')));
const ruleOf = sel => rules.find(r => r.sel === sel);
const root = ruleOf('html');
ok('the standard depth in the style sheet is the standard level of the Depth (0.35), as --depth, and --d follows it', !!root && /--depth:\.35;/.test(root.body) && /--d:var\(--depth\)/.test(root.body) && D.factorOf(undefined) === 0.35);
ok('...with the light white from above, the black shadow and the full strength (--k:1) on a dark page', /--k:1;/.test(root.body) && /--hl:255,255,255;/.test(root.body) && /--sh:0,0,0;/.test(root.body));
const light = ruleOf('[data-theme="light"],[data-theme="ocean"],[data-tone="light"]');
ok('a light page (Light, Ocean, and a Custom theme with light panels) has softer shadows in the colour of its text (--k .6)', !!light && /--k:\.6;/.test(light.body) && /--sh:29,34,41;/.test(light.body) && /--lipa:\.18/.test(light.body));
// which ready-made themes are light is decided by their panels; the style sheet names the same ones
{ const sheet = {}; for (const m of css.matchAll(/^\[data-theme="(\w+)"\]\{([^}]*)\}/gm)) sheet[m[1]] = Object.fromEntries(m[2].split(';').filter(Boolean).map(x => x.split(':')).map(([k, v]) => [k.replace(/^--/, ''), v]));
  const lightOnes = Object.keys(sheet).filter(k => T.isLight(sheet[k].panel)).sort().join(), named = [...(light ? light.sel : '').matchAll(/data-theme="(\w+)"/g)].map(m => m[1]).sort().join();
  ok('...and those are exactly the ready-made themes whose panels are light', lightOnes === 'light,ocean' && named === lightOnes);
  ok('the Custom theme is told apart the same way: light panels are light, dark panels and rubbish are not', T.isLight('#ffffff') && T.isLight('#f1efea') && T.isLight('#e8f1f6') && !T.isLight('#222831') && !T.isLight('#000') && !T.isLight('#1e1e1e') && !T.isLight('red') && !T.isLight(undefined) && !T.isLight('') && Object.keys(sheet).every(k => T.isLight(sheet[k].panel) === (k === 'light' || k === 'ocean'))); }
ok('a widget has a depth of its own: the page\'s depth times how solid it is (--wf, from frame.js), solid when nothing says', !!ruleOf('.lw') && ruleOf('.lw').body === '--d:calc(var(--depth)*var(--wf,1))');

// the surfaces, buttons, keys and what is pressed in
const surf = rules.find(r => r.sel.startsWith('.card,')), btn = rules.find(r => r.sel.startsWith('.btn:not(:disabled),')), key = rules.find(r => r.sel.startsWith('.trk-btn:not(:disabled),'));
const sels = r => (r ? split(r.sel, ',') : []);
ok('cards, bars, folders, dialogs, tiles and the widgets of a layout stand up', ['.card', '.bar', '.ed-bar', '.ed-pal', '.ed-side', '.gcard', '.viewbar', '.fgroup', '.audgroup', '.dbfolder', '.audhelp', '.lv-tile', '.lv-board', '.lv-stat', '.tkchip', '.helpwelcome', 'dialog'].every(s => sels(surf).includes(s)));
ok('...a widget only when it is not a cell of a row design, not a flat one (the row designs of the editor), and not a button widget (those are keys)', sels(surf).includes('.lw:not(.rcell):not(.flat):not(.btnw)'));
ok('buttons are shallow: .btn (when it can be used), plan cards, and the sub-tab buttons that are not the open one', ['.btn:not(:disabled)', '.roplan', '.sstab:not([aria-selected="true"])', '.ssbig:not([aria-selected="true"])'].every(s => sels(btn).includes(s)));
ok('the lane buttons of the race screen and the button widgets of a layout are the big, key-like ones', sels(key).join() === '.trk-btn:not(:disabled),.lw.btnw');
ok('a button that cannot be used stays flat (it is left out of the rules above)', [surf, btn, key].every(r => !sels(r).some(s => /^\.btn$|^\.trk-btn$/.test(s))));
ok('each of the three has the same five layers: light edge, light from above, shade below, the lip, the shadow', [surf, btn, key].every(r => { const v = decls(r.body).find(d => d[0] === 'box-shadow')[1]; return split(v, ',').length === 5; }) && decls(surf.body)[0][1].split(' ').length > 5);
ok('the lip (the thickness) is the only layer with a hard edge: no blur, an offset that grows with the depth', [surf, btn, key].every(r => /0 calc\(\d(\.\d)?px\*var\(--d\)\) 0 rgba\(var\(--sh\),var\(--lipa\)\)/.test(r.body)));
const pressed = ruleOf('.btn:not(:disabled):active,.btn[aria-pressed="true"]:not(:disabled),.lw.btnw:active');
ok('a pressed button, a switched on one and a pressed button widget move down and sit in', !!pressed && /transform:translateY\(calc\(2px\*var\(--d\)\)\)/.test(pressed.body) && /box-shadow:inset 0 calc\(2px \+ 2px\*var\(--d\)\)/.test(pressed.body));
const trkP = ruleOf('.trk-btn:not(:disabled):active'), trkOn = ruleOf('.trk-btn[aria-pressed="true"],.trk-btn[data-active="true"]');
ok('the lane buttons keep their small press of before when the page is flat (1 px and .99), and move further when deeper', !!trkP && /translateY\(max\(1px,calc\(3px\*var\(--d\)\)\)\) scale\(\.99\)/.test(trkP.body));
ok('...a switched on Pit and an active Call sit in and keep the ring in their own colour', !!trkOn && /transform:translateY\(calc\(3px\*var\(--d\)\)\)/.test(trkOn.body) && /0 0 0 3px color-mix\(in srgb,var\(--tc\) 45%,transparent\)/.test(trkOn.body));
const canvas = ruleOf('.canvas.live'), wells = rules.find(r => r.sel === '.trk-card,.hm-tile,.hm-ctile'), inputs = rules.find(r => r.sel.startsWith('input[type=text]')), header = ruleOf('header');
ok('what is pressed in: the canvas of the race screen (still with its ring of before), the lane cards, the tiles of Home, the entry fields', !!canvas && canvas.body.startsWith('box-shadow:0 0 0 1px var(--line),inset ') && !!wells && /^box-shadow:inset 0 calc\(2px/.test(wells.body) && !!inputs && /^box-shadow:inset 0 1px 2px/.test(inputs.body) && inputs.sel.includes('textarea') && inputs.sel.includes('select'));
ok('the bar at the top throws a short shadow on the page', !!header && /^box-shadow:0 calc\(1px/.test(header.body));
ok('the full screen view of a race still has no ring and no shadow on its canvas (a rule with more weight than the one above)', /\.fullview \.canvas\.live\{margin:0;box-shadow:none\}/.test(css.slice(0, from)));

// ---- Flat draws nothing: with --depth 0 every layer of every shadow is invisible (no colour, or no size at all), except the ring of the canvas and the small press of the lane buttons
const calc = (expr, d, k) => { const e = expr.replace(/var\(--d\)/g, String(d)).replace(/var\(--k\)/g, String(k)).replace(/var\(--lipa\)/g, '.5').replace(/calc/g, '').replace(/(\d|\))px/g, '$1').replace(/\bmax\b/g, 'Math.max'); return Function('return (' + e + ')')(); };
const layers = (value, d, k) => split(value.replace(/var\(--hl\)/g, '255,255,255').replace(/var\(--sh\)/g, '0,0,0'), ',').map(layer => {
  const ci = layer.search(/rgba\(|var\(--line\)|color-mix\(/), lens = split(layer.slice(0, ci).replace(/^inset\s+/, ''), ' ').map(x => calc(x, d, k)), colour = layer.slice(ci);
  const alpha = colour.startsWith('rgba(') ? calc(split(colour.slice(5, -1), ',')[3], d, k) : 1;
  return { inset: /^inset/.test(layer), lens, alpha, colour };
});
const visible = l => l.alpha > 0 && !(!l.inset && l.lens.every(x => x === 0));
let shown = 0, everyLayer = 0;
for (const r of rules) for (const [k, v] of decls(r.body)) if (k === 'box-shadow') for (const kk of [1, 0.6]) {
  const ls = layers(v, 0, kk); everyLayer += ls.length;
  const seen = ls.filter(visible); shown += seen.length;
  if (seen.some(l => !(l.colour === 'var(--line)' || /color-mix/.test(l.colour)))) { console.log('  visible at 0:', r.sel, JSON.stringify(seen)); shown += 100; }
}
ok('with --depth 0 (Flat) no layer of any shadow shows, on a dark and on a light page, except the old 1 px ring of the canvas and the ring of a switched on Pit/Call', everyLayer > 40 && shown === 4);
{ const probe = layers(surf.body.slice('box-shadow:'.length), 0.35, 1); ok('...and at the standard depth they do show (a light edge, a lip of 1.4 px, a shadow of 6.5 px down)', probe.filter(visible).length === 5 && probe[3].lens[1] === 1.4 && Math.abs(probe[4].lens[1] - 6.5) < 1e-9); }
{ const deep = layers(surf.body.slice('box-shadow:'.length), 0.75, 1); ok('...and at Thick card the lip is 3 px and the shadow 10.5 px down', deep[3].lens[1] === 3 && Math.abs(deep[4].lens[1] - 10.5) < 1e-9); }

// ---- the app
const app = read('app.js'), ui = read('themeui.js'), html = read('index.html');
ok('depth.js is loaded by the page after uiscale.js and before the code that uses it', html.indexOf('<script src="uiscale.js">') > 0 && html.indexOf('<script src="depth.js">') > html.indexOf('<script src="uiscale.js">') && html.indexOf('<script src="depth.js">') < html.indexOf('<script src="themeui.js">') && html.indexOf('<script src="depth.js">') < html.indexOf('<script src="app.js">'));
{ const boot = app.slice(app.lastIndexOf('(async () => {')), live = boot.indexOf("location.hash === '#live'");
  ok('the depth is put on the page when the app starts, before the Live Race window or the main window goes its own way (and so also on a phone)', /applyTheme\(\); applyDepth\(\); applyLayers\(\); applyName\(\);/.test(boot) && boot.indexOf('applyDepth()') < live && boot.indexOf('applyLayers()') < live); }
ok('applyDepth gives the page one number: --depth, the saved level divided by 100 (the standard when nothing is saved)', /function applyDepth\(\) \{\s*document\.documentElement\.style\.setProperty\('--depth', String\(Depth\.factorOf\(state\.settings && state\.settings\.depth\)\)\);\s*\}/.test(ui));
ok('the Custom theme tells the page when its panels are light (data-tone), and any other theme takes it away again', /if \(custom && Theme\.isLight\(c\.panel\)\) root\.dataset\.tone = 'light'; else delete root\.dataset\.tone;/.test(ui));
ok('the Depth is a choice in App Settings > General > Display, saved as depth, applied at once', /id="depthlevel"/.test(app) && /api\.setSettings\(\{ depth: Depth\.levelOf\(ev\.target\.value\) \}\); applyDepth\(\);/.test(app));
ok('...and it says what it does and that Flat is the plain look of before', /Flat is the plain look of before/.test(app) && /whole app/.test(app) && /widgets of your layouts/.test(app));

// ---- the widgets of a layout (canvas.js paints the live ones, editor.js draws them in the editor)
const canvasJs = read('canvas.js'), editor = read('editor.js');
ok('a live widget gets its solidity as --wf (and the thickness of its border) every time it is painted', /Frame\.style\(out\.bg \|\| n\.base\.bg, n\.w, 'var\(--line\)', n\.layout, Widgets\.U\)/.test(canvasJs) && /setProperty\('--wf', String\(Frame\.solidity\(n\.w, n\.layout\)\)\)/.test(canvasJs));
ok('a widget in the editor gets the same, and the widgets of a row design are marked flat (they have a look of their own)', /Frame\.css\(col\.bg, w, 'var\(--muted\)', d, U\)\};--wf:\$\{Frame\.solidity\(w, d\)\}/.test(editor) && /\$\{d\.kind === 'row' \? ' flat' : ''\}/.test(editor));

// ---- 1.60.3: the widgets' changing text on layers of their own (Depth.layersOn, applyLayers, the tickbox, the rule of the style sheet)
ok('layersOn: on when nothing is saved (and for a setting that is no setting)', D.layersOn(undefined) === true && D.layersOn(null) === true && D.layersOn({}) === true && D.layersOn('x') === true && D.layersOn(5) === true && D.layersOn([]) === true);
ok('...only an explicit false switches it off (0, "false", null or a text do not)', D.layersOn({ widgetLayers: false }) === false && [0, '', 'false', null, undefined, 'off', NaN, true, 1, 'on'].every(v => D.layersOn({ widgetLayers: v }) === true));
{ const fn = (/function applyLayers\(\) \{[^}]*\}/.exec(ui) || [''])[0];
  const vm = require('vm'), page = { documentElement: { dataset: {} } }, state = { settings: {} };
  const run = st => { state.settings = st; vm.runInNewContext(fn + '; applyLayers();', { document: page, Depth: D, state }); return page.documentElement.dataset.layers; };
  ok('applyLayers puts data-layers on the page: "on" by default and "off" when the tickbox was taken away', run({}) === 'on' && run({ widgetLayers: false }) === 'off' && run({ widgetLayers: true }) === 'on' && run(undefined) === 'on'); }
{ const boot = app.slice(app.lastIndexOf('(async () => {')); const live = boot.indexOf("location.hash === '#live'");
  ok('the layers are put on the page at the start, before the Live Race window or the main window goes its own way (and so also on a phone)', boot.indexOf('applyLayers()') > 0 && boot.indexOf('applyLayers()') < live); }
ok('the tickbox is in App Settings > General > Performance, ticked unless it was switched off, before the switch of the Performance line', /<input id="layerswitch" type="checkbox"\$\{Depth\.layersOn\(S\) \? ' checked' : ''\}>/.test(app) && app.indexOf('id="layerswitch"') > app.indexOf("sf('performance'") && app.indexOf('id="layerswitch"') < app.indexOf('id="perfswitch"'));
ok('...it is saved as widgetLayers (true or false), the page gets the new state at once, and the page is not drawn again', /\$\('layerswitch'\)\.onchange = async ev => \{ state\.settings = await api\.setSettings\(\{ widgetLayers: !!ev\.target\.checked \}\); applyLayers\(\); \};/.test(app));
ok('...it says what it does, and that text can be softer on some Windows computers', /Draw the changing text of each widget on its own layer/.test(app) && /softer on some Windows/.test(app) && /switch this off/.test(app));
{ const sheet = css.replace(/\/\*[\s\S]*?\*\//g, ''), mine = sheet.match(/[^{}]*will-change[^{}]*\{[^{}]*\}|[^{}]*\{[^{}]*will-change[^{}]*\}/g) || [];
  ok('the style sheet has one rule for the layers: the changing text of a live widget, only when the page says "on", and nothing else but will-change: transform', /html\[data-layers="on"\] \.lw\.live \.lw-val\{will-change:transform\}/.test(sheet) && (sheet.match(/will-change/g) || []).length === 1 && mine.length === 1);
  ok('...it is not for the Layout Editor, the cells of a row design, or the widget itself (no .rcell, no canvas, no .lw without .live)', !/data-layers[^{]*(rcell|editor|canvas|row)/.test(sheet) && /data-layers="on"\] \.lw\.live \.lw-val/.test(sheet) && !/data-layers="on"\] \.lw[^.]/.test(sheet));
  ok('...it comes before the Soft lift part, which stays at the end of the style sheet', css.indexOf('html[data-layers="on"]') > 0 && css.indexOf('html[data-layers="on"]') < from && css.lastIndexOf('/* ----') === from);
  ok('...and the Soft lift part does not touch it (will-change, data-layers)', !/will-change|data-layers/.test(layer)); }
ok('the Live Race page and the phone page load the same style sheet and the same Depth (so they get the layers too)', /styles\.css/.test(html) && /<script src="depth\.js">/.test(html));

// ---- the reference set (docs/ui-reference/depth): the pictures and the design boards stay with the code
{ const dir = path.join(__dirname, '..', 'docs', 'ui-reference', 'depth'), pics = ['1-race-screen-flat.png', '2-race-screen-soft-lift.png', '3-race-screen-thick-card.png', '4-race-screen-light-soft-lift.png', '5-widget-border-colour-and-thickness.png', '6-home-soft-lift.png', '7-settings-depth.png'];
  const png = f => { try { const b = fs.readFileSync(path.join(dir, f)); return b.length > 5000 && b.slice(1, 4).toString() === 'PNG'; } catch { return false; } };
  ok('the reference set has the seven pictures (real PNG files) and the boards with their canvas', pics.every(png) && ['Main', 'Soft', 'Thick', 'States'].every(n => fs.existsSync(path.join(dir, 'source', n + '.dc.html'))) && fs.existsSync(path.join(dir, 'source', 'canvas.json')));
  const readme = fs.readFileSync(path.join(__dirname, '..', 'docs', 'ui-reference', 'README.md'), 'utf8');
  ok('...and the reference README names the set, with every picture', /## depth\//.test(readme) && pics.every(f => readme.includes('`' + f + '`')) && /Soft lift/.test(readme)); }

// 1.61.2: the tickbox that switches the background save of the database off
ok('1.61.2: the tickbox "Save changes to the database in the background" is in App Settings > General > Performance, ticked unless backgroundSave is false, before the switch of the Performance line', /<input id="bgsave" type="checkbox"\$\{S\.backgroundSave === false \? '' : ' checked'\}> Save changes to the database in the background/.test(app) && app.indexOf('id="bgsave"') > app.indexOf('id="layerswitch"') && app.indexOf('id="bgsave"') < app.indexOf('id="perfswitch"'));
ok('...it is saved as backgroundSave (true or false) and the program reads it from the settings at once', /\$\('bgsave'\)\.onchange = async ev => \{ state\.settings = await api\.setSettings\(\{ backgroundSave: !!ev\.target\.checked \}\); \}/.test(app));
ok('...it says what it does and how to go back to the old way', /the whole database file is written again/.test(app) && /the program goes on while the file is written/.test(app) && /Switch this off to go back to the old way/.test(app));

if (fails) { console.log('\n' + fails + ' FAILED'); process.exit(1); }
console.log('ALL DEPTH TESTS PASSED');
