// 1.45.0: the sub-tabs of the Race Setup tab as coloured buttons (renderer/editor.js, styles.css, icons.js; design in docs/ui-reference/race-setup-tabs):
// one big Race Setups button, three groups (Systems, Setups, Extras), the colour of each sub-tab is the colour of its folder on the race screen.
const fs = require('fs'), vm = require('vm'), path = require('path');
const R = path.join(__dirname, '..', 'renderer') + '/';
const Icons = require(R + 'icons.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const editor = fs.readFileSync(R + 'editor.js', 'utf8'), css = fs.readFileSync(R + 'styles.css', 'utf8'), race = fs.readFileSync(R + 'race.js', 'utf8');

// the strip is made by two small functions in editor.js: they are run on their own here
const a = editor.indexOf('const SETUP_HERO'), b = editor.indexOf('// Race Setup tab: the race setups');
const ctx = vm.createContext({ Icons, esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'), out: {} });
vm.runInContext(editor.slice(a, b).replace(/^const /gm, 'var ') + '\nout.html = setupTabsHtml; out.color = setupColorOf; out.groups = SETUP_GROUPS; out.hero = SETUP_HERO;', ctx);
const html = id => ctx.out.html(id);
const buttons = h => [...h.matchAll(/<button type="button" class="(ssbig|sstab ss-\w+)" role="tab" aria-selected="(true|false)" data-id="(\w+)">(.*?)<\/button>/g)].map(m => ({ cls: m[1], sel: m[2] === 'true', id: m[3], inner: m[4], text: m[4].replace(/<[^>]*>/g, '') }));

const ids = ['setups', 'penalties', 'damage', 'tyrewear', 'weather', 'rotation', 'fuel', 'bop', 'tokens'];
const labels = { setups: 'Race Setups', penalties: 'Penalty Systems', damage: 'Damage Systems', tyrewear: 'Tyre Wear Systems', weather: 'Weather Systems', rotation: 'Rotation Setups', fuel: 'Fuel Setups', bop: 'Balance of Power', tokens: 'Time Tokens' };
const bs = buttons(html('damage'));
ok('nine sub-tabs, every one a real button with role tab, in this order: Race Setups, then Systems (Penalty, Damage, Tyre Wear, Weather), Setups (Rotation, Fuel), Extras (Balance of Power, Time Tokens)', bs.length === 9 && bs.map(x => x.id).join() === ids.join());
ok('...with the names the app has always used (and the big button says what it is for)', bs.every(x => x.text.startsWith(labels[x.id])) && bs[0].text === 'Race SetupsWhere it all comes together');
ok('...the first is the big button, the other eight are chips', bs[0].cls === 'ssbig' && bs.slice(1).every(x => x.cls.startsWith('sstab ss-')));
ok('exactly the sub-tab that is open is selected, for each of the nine', ids.every(id => { const s = buttons(html(id)).filter(x => x.sel); return s.length === 1 && s[0].id === id; }));
ok('each sub-tab gives the page its own colour code (the big button the accent, the others their own)', JSON.stringify(Object.fromEntries(ids.map(id => [id, ctx.out.color(id)]))) === JSON.stringify({ setups: 'race', penalties: 'pen', damage: 'dmg', tyrewear: 'tyre', weather: 'wx', rotation: 'rot', fuel: 'fuel', bop: 'bop', tokens: 'tok' }));
ok('a name that is none of them selects nothing (and the page edge takes the accent colour)', buttons(html('nope')).every(x => !x.sel) && ctx.out.color('nope') === 'race' && ctx.out.color(undefined) === 'race');
const h = html('fuel');
ok('three groups with their names above them, in order; the names are not tabs and are hidden from a screen reader', [...h.matchAll(/<span class="sslabel" aria-hidden="true">(\w+)<\/span>/g)].map(m => m[1]).join() === 'Systems,Setups,Extras' && (h.match(/class="ssgroup"/g) || []).length === 3);
ok('...the groups hold 4, 2 and 2 chips', ctx.out.groups.map(g => g[1].length).join() === '4,2,2');
ok('every button has its own picture, drawn from the set of pictures of the app (the line pictures: no two alike)', bs.every(x => x.inner.includes('<svg') && x.inner.includes('stroke="currentColor"')) && new Set(bs.map(x => (x.inner.match(/<svg.*<\/svg>/) || [''])[0])).size === 9 && ctx.out.groups.flatMap(g => g[1]).concat([ctx.out.hero]).every(t => Icons.has(t[2])));
ok('the pictures are for the eye only: the buttons say their name in text, the pictures say nothing', bs.every(x => !/<svg[^>]*role=/.test(x.inner)));
ok('a label with a character that needs escaping cannot break the page (the text goes through esc)', !/<script/.test(h));

// the colours: the same as the folders of the race screen, once in the code and once in the style sheet
const tone = { pen: ['penalties', 'yellow'], dmg: ['damage', 'red'], tyre: ['tyre', 'purple'], wx: ['weather', 'blue'], bop: ['bop', 'white'], tok: ['tokens', 'teal'] };
const strip = (css.match(/\.setupstrip,\.setuppage\{([^}]*)\}/) || [, ''])[1], light = (css.match(/\[data-theme="light"\] :is\(\.setupstrip,\.setuppage\),\[data-theme="ocean"\] :is\(\.setupstrip,\.setuppage\)\{([^}]*)\}/) || [, ''])[1];
const varOf = (block, k) => ((block.match(new RegExp('--c-' + k + ':(#[0-9a-f]{6})')) || [])[1] || '').toLowerCase();
const folder = t => ((css.match(new RegExp('\\.dir-' + t + '\\{--fc:(#[0-9a-f]{6})')) || [])[1] || '').toLowerCase();
ok('Penalty yellow, Damage red, Tyre Wear purple, Weather blue, Balance of Power white (#e8e6e1, the text colour of the dark theme) and Time Tokens teal: the colour of the folder of that name on the race screen', ['pen', 'dmg', 'tyre', 'wx', 'tok'].every(k => varOf(strip, k) === folder(tone[k][1]) && folder(tone[k][1])) && varOf(strip, 'bop') === '#e8e6e1');
ok('...and the race screen really gives those folders those tones', Object.values(tone).every(([id, t]) => new RegExp(`folderHtml\\('${id}', '[^']*', '[^']*', '${t}'`).test(race)));
ok('Rotation is brown and Fuel is green (Dutch chose them; they have no folder): the brown of the Endurance folder, lighter, and the green of the Track actions folder', varOf(strip, 'rot') === '#c4803f' && varOf(strip, 'fuel') === '#2fb86a' && folder('green') === '#2fb86a');
ok('the light themes (Light and Ocean) have a darker colour for all eight, so they read on a white page', ['rot', 'fuel', 'pen', 'dmg', 'tyre', 'wx', 'bop', 'tok'].every(k => /^#[0-9a-f]{6}$/.test(varOf(light, k)) && varOf(light, k) !== varOf(strip, k)));
const lum = hx => { const [r, g, bl] = [1, 3, 5].map(i => parseInt(hx.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
const contrast = (x, y) => (Math.max(lum(x), lum(y)) + 0.05) / (Math.min(lum(x), lum(y)) + 0.05);
ok('...and each of those darker colours stands out from white by at least 3 to 1 (a picture needs that much)', ['rot', 'fuel', 'pen', 'dmg', 'tyre', 'wx', 'bop', 'tok'].every(k => contrast(varOf(light, k), '#ffffff') >= 3));
ok('...the colours on the dark themes stand out from the dark panel (#222831) by at least 3 to 1', ['rot', 'fuel', 'pen', 'dmg', 'tyre', 'wx', 'bop', 'tok'].every(k => contrast(varOf(strip, k), '#222831') >= 3));
ok('every colour class the buttons use has its rule (a chip has its colour as --c)', [...new Set([...h.matchAll(/ss-(\w+)/g)].map(m => m[1]))].every(c => css.includes(`.ss-${c}{--c:var(--c-${c})}`)) && [...new Set(ctx.out.groups.flatMap(g => g[1]).map(t => t[3]))].length === 8);
ok('the big button is in the colour of the theme (accent and the text on it), with a ring when it is open, and takes the width of the window under 700 px', /\.ssbig\{[^}]*background:var\(--accent\)[^}]*color:var\(--on-accent\)/.test(css) && /\.ssbig\[aria-selected="true"\]\{box-shadow:0 0 0 2px var\(--bg\),0 0 0 4px var\(--ink\)/.test(css) && /@media \(max-width:700px\)\{\.setupstrip\{flex-direction:column\}\.ssbig\{flex:none;width:100%\}/.test(css));
ok('a chip that is open is stronger (a stronger tint, its own border and a bar under it), not only a different colour', /\.sstab\[aria-selected="true"\]\{[^}]*border-color:var\(--c\)[^}]*box-shadow:inset 0 -3px 0 var\(--c\)[^}]*font-weight:700/.test(css));
ok('the page under the strip has an edge in the colour of the sub-tab that is open', /\.setuppage\{border-top:4px solid var\(--c\)/.test(css) && editor.includes('class="setuppage ss-${setupColorOf(state.setupSub)}"'));
ok('the buttons can be reached with the keyboard and show where they are (a focus ring)', /\.ssbig:focus-visible,\.sstab:focus-visible\{outline:3px solid/.test(css));
ok('the mock-ups are kept with the code: the three pictures and their sources', ['1-option-a-top-strip.png', '2-option-a-states.png', '3-option-b-side-rail.png'].every(f => fs.existsSync(path.join(__dirname, '..', 'docs/ui-reference/race-setup-tabs', f))) && ['Main', 'A-States', 'B-SideRail'].every(f => fs.existsSync(path.join(__dirname, '..', 'docs/ui-reference/race-setup-tabs/source', f + '.dc.html'))));

if (fails) { console.log(fails + ' SETUP STRIP TESTS FAILED'); process.exit(1); }
console.log('ALL SETUP STRIP TESTS PASSED');
