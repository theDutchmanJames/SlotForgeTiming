// 1.45.0: the sub-tabs of the Race Setup tab as coloured buttons (renderer/editor.js, styles.css, icons.js; design in docs/ui-reference/race-setup-tabs):
// one big Race Setups button, three groups (Systems, Setups, Extras), the colour of each sub-tab is the colour of its folder on the race screen.
// 1.51.0: the sub-tabs of the other main tabs are the same buttons without the colours (the last tests).
const fs = require('fs'), vm = require('vm'), path = require('path');
const R = path.join(__dirname, '..', 'renderer') + '/';
const Icons = require(R + 'icons.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
// Check the common light palette independently of its additional custom-light selector.
const editor = fs.readFileSync(R + 'editor.js', 'utf8'), css = fs.readFileSync(R + 'styles.css', 'utf8'), race = fs.readFileSync(R + 'race.js', 'utf8');

// the strip is made by two small functions in editor.js: they are run on their own here
const a = editor.indexOf('const SETUP_HERO'), b = editor.indexOf('// Race Setup tab: the race setups');
const ctx = vm.createContext({ Icons, esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'), out: {} });
vm.runInContext(editor.slice(a, b).replace(/^const /gm, 'var ') + '\nout.html = setupTabsHtml; out.color = setupColorOf; out.groups = SETUP_GROUPS; out.hero = SETUP_HERO;', ctx);
const html = id => ctx.out.html(id);
const buttons = h => [...h.matchAll(/<button type="button" class="(ssbig|sstab ss-\w+)" role="tab" aria-selected="(true|false)" data-id="(\w+)">(.*?)<\/button>/g)].map(m => ({ cls: m[1], sel: m[2] === 'true', id: m[3], inner: m[4], text: m[4].replace(/<[^>]*>/g, '') }));

const ids = ['setups', 'fuel', 'tyrewear', 'penalties', 'damage', 'safetycar', 'weather', 'pushsave', 'rotation', 'championships', 'bop', 'tokens', 'virtualrivals', 'multiclass', 'resources'];
const labels = { setups: 'Race Setups', penalties: 'Penalty Systems', damage: 'Damage Systems', tyrewear: 'Tyre Wear Systems', weather: 'Weather Systems', safetycar: 'Safety Car Systems', pushsave: 'Push &amp; Save Systems', rotation: 'Rotation Setups', fuel: 'Fuel Systems', championships: 'Championships', bop: 'Balance of Power', tokens: 'Time Tokens', virtualrivals: 'Virtual Rival Systems', multiclass: 'Multi-Class Systems', resources:'Resource Systems' };
const bs = buttons(html('damage'));
ok('fifteen sub-tabs, every one a real button with role tab, in this order: Race Setups, then Systems (Penalty, Damage, Fuel, Tyre Wear, Weather, Safety Car, Push and Save), Setups (Rotation, Championships), Extras (Balance of Power, Time Tokens, Virtual Rival Systems)', bs.length === 15 && bs.map(x => x.id).join() === ids.join());
ok('...with the names the app has always used (and the big button says what it is for)', bs.every(x => x.text.startsWith(labels[x.id])) && bs[0].text === 'Race SetupsWhere it all comes together');
ok('...the first is the big button, the other thirteen are chips', bs[0].cls === 'ssbig' && bs.slice(1).every(x => x.cls.startsWith('sstab ss-')));
ok('exactly the sub-tab that is open is selected, for each of the fifteen', ids.every(id => { const s = buttons(html(id)).filter(x => x.sel); return s.length === 1 && s[0].id === id; }));
ok('each sub-tab gives the page its own colour code (the big button the accent, the others their own)', JSON.stringify(Object.fromEntries(ids.map(id => [id, ctx.out.color(id)]))) === JSON.stringify({ setups: 'race', fuel: 'fuel', tyrewear: 'tyre', penalties: 'pen', damage: 'dmg', safetycar: 'sc', weather: 'wx', pushsave: 'ps', rotation: 'rot', championships: 'ch', bop: 'bop', tokens: 'tok', virtualrivals: 'vr', multiclass: 'mc', resources:'resource' }));
ok('a name that is none of them selects nothing (and the page edge takes the accent colour)', buttons(html('nope')).every(x => !x.sel) && ctx.out.color('nope') === 'race' && ctx.out.color(undefined) === 'race');
const h = html('fuel');
ok('three disclosure groups retain the other tabs and identify their active system', (h.match(/<details class="ssgroup ssdropdown/g)||[]).length===3 && html('damage').includes('<summary class="sscurrent">Damage Systems</summary>') && !h.includes('class="sscurrent"') && h.includes('Rotations &amp; Championships') && h.includes('More Systems'));
ok('Fuel, Tyre Wear and Penalty are direct tabs, each appearing once outside the menus', buttons(h.slice(0,h.indexOf('<div class="ssgroups">'))).map(x=>x.id).join()==='setups,fuel,tyrewear,penalties' && ['fuel','tyrewear','penalties'].every(id=>buttons(h).filter(b=>b.id===id).length===1));
ok('...the groups hold 7, 2 and 5 chips', ctx.out.groups.map(g => g[1].length).join() === '7,2,5');
ok('every button has its own picture, drawn from the set of pictures of the app (the line pictures: no two alike)', bs.every(x => x.inner.includes('<svg') && x.inner.includes('stroke="currentColor"')) && new Set(bs.map(x => (x.inner.match(/<svg.*<\/svg>/) || [''])[0])).size === 15 && ctx.out.groups.flatMap(g => g[1]).concat([ctx.out.hero]).every(t => Icons.has(t[2])));
ok('the pictures are for the eye only: the buttons say their name in text, the pictures say nothing', bs.every(x => !/<svg[^>]*role=/.test(x.inner)));
ok('a label with a character that needs escaping cannot break the page (the text goes through esc)', !/<script/.test(h));

// the colours: the same as the folders of the race screen, once in the code and once in the style sheet
const tone = { pen: ['penalties', 'yellow'], dmg: ['damage', 'red'], tyre: ['tyre', 'purple'], wx: ['weather', 'blue'], bop: ['bop', 'white'], tok: ['tokens', 'teal'] };
const strip = (css.match(/\.setupstrip,\.setuppage,\.setupform(?:,\.help-hub)?\{([^}]*)\}/) || [, ''])[1], light = (css.match(/\[data-theme="light"\] :is\(\.setupstrip,\.setuppage,\.setupform\)[^\{]*\{([^}]*)\}/) || [, ''])[1]; // (the strip, the page and the windows that open from it share the colours: 1.47.2)
const varOf = (block, k) => ((block.match(new RegExp('--c-' + k + ':(#[0-9a-f]{6})')) || [])[1] || '').toLowerCase();
const folder = t => ((css.match(new RegExp('\\.dir-' + t + '\\{--fc:(#[0-9a-f]{6})')) || [])[1] || '').toLowerCase();
ok('Penalty yellow, Damage red, Tyre Wear purple, Weather blue, Balance of Power white (#e8e6e1, the text colour of the dark theme) and Time Tokens teal: the colour of the folder of that name on the race screen', ['pen', 'dmg', 'tyre', 'wx', 'tok'].every(k => varOf(strip, k) === folder(tone[k][1]) && folder(tone[k][1])) && varOf(strip, 'bop') === '#e8e6e1');
ok('...and the race screen really gives those folders those tones', Object.values(tone).every(([id, t]) => new RegExp(`folderHtml\\('${id}', '[^']*', '[^']*', '${t}'`).test(race)));
ok('Rotation is brown and Fuel is green (Dutch chose them; they have no folder): the brown of the Endurance folder, lighter, and the green of the Track actions folder', varOf(strip, 'rot') === '#c4803f' && varOf(strip, 'fuel') === '#2fb86a' && folder('green') === '#2fb86a');
ok('the light themes (Light and Ocean) have a darker colour for all ten, so they read on a white page', ['rot', 'fuel', 'pen', 'dmg', 'tyre', 'wx', 'bop', 'tok', 'sc', 'ch'].every(k => /^#[0-9a-f]{6}$/.test(varOf(light, k)) && varOf(light, k) !== varOf(strip, k)));
const lum = hx => { const [r, g, bl] = [1, 3, 5].map(i => parseInt(hx.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
const contrast = (x, y) => (Math.max(lum(x), lum(y)) + 0.05) / (Math.min(lum(x), lum(y)) + 0.05);
ok('...and each of those darker colours stands out from white by at least 3 to 1 (a picture needs that much)', ['rot', 'fuel', 'pen', 'dmg', 'tyre', 'wx', 'bop', 'tok', 'sc', 'ch'].every(k => contrast(varOf(light, k), '#ffffff') >= 3));
ok('...the colours on the dark themes stand out from the dark panel (#222831) by at least 3 to 1', ['rot', 'fuel', 'pen', 'dmg', 'tyre', 'wx', 'bop', 'tok', 'sc', 'ch'].every(k => contrast(varOf(strip, k), '#222831') >= 3));
ok('every colour class the buttons use has its rule (a chip has its colour as --c)', [...new Set([...h.matchAll(/ss-(\w+)/g)].map(m => m[1]))].every(c => css.includes(`.ss-${c}{--c:var(--c-${c});--on:var(--on-${c})}`)) && [...new Set(ctx.out.groups.flatMap(g => g[1]).map(t => t[3]))].length === 14);
ok('Race Setups uses a subtle theme tint and selection underline; narrow menus reflow to one column', css.includes('background:color-mix(in srgb,var(--accent) 12%,var(--panel))') && css.includes('.ssbig[aria-selected="true"]{box-shadow:inset 0 -2px 0 var(--accent)}') && css.includes('.ssdropdown[open]>.sschips{grid-template-columns:1fr}'));
ok('a chip that is open is stronger (a stronger tint, its own border and a bar under it), not only a different colour', /\.sstab\[aria-selected="true"\]\{[^}]*border-color:var\(--c\)[^}]*box-shadow:inset 0 -3px 0 var\(--c\)[^}]*font-weight:700/.test(css));
ok('1.47.1: the page under the strip has no coloured stripe any more (no border on .setuppage), but it still carries the colour of the sub-tab that is open (the Add button and the cards use it)', !/\.setuppage\{[^}]*border/.test(css) && !/\.setuppage\{[^}]*padding-top/.test(css) && editor.includes('class="setuppage ss-${setupColorOf(state.setupSub)}"'));
ok('1.47.1: the Add button (and every other main button) on a Race Setup page, and the Grid / List switch (1.47.2), are in the colour of the sub-tab, with the text colour that goes on it', /\.setuppage \.btn\.primary,\.setuppage \.seg \.btn\.on\{background:var\(--c\);border-color:var\(--c\);color:var\(--on\)\}/.test(css));
ok('1.47.1: the Race Setups page has the colour of the theme, with the text of the theme on it (--on-race is --on-accent, and the class ss-race says so)', /--on-race:var\(--on-accent\)/.test(strip) && css.includes('.ss-race{--c:var(--c-race);--on:var(--on-race)}'));
ok('1.47.2: the windows that open from a Race Setup page (a form, Extra fields) have the sub-tab colour in place of the accent of the theme: --accent and --on-accent are the colour and its text, so the folders, the Save button and whatever else inside uses the accent follow', /\.setupform:not\(\.ss-race\)\{--accent:var\(--c\);--on-accent:var\(--on\)\}/.test(css));
ok('1.47.2: ...except Race Setups, which keeps the accent of the theme (an override there would make --c-race and --accent refer to each other)', css.includes('.setupform:not(.ss-race)') && !/\.setupform\{[^}]*--accent:/.test(css) && !/\.setupform\.ss-race\{[^}]*--accent:/.test(css));
ok('1.47.2: ...and the window is given the colours themselves (the tokens are defined for .setupform too, dark and light)', strip.includes('--c-tyre:#9b4dff') && light.includes('--c-tyre:#7c3aed'));
const onOf = (block, k) => ((block.match(new RegExp('--on-' + k + ':(#[0-9a-f]{3,6})')) || [])[1] || '').toLowerCase().replace(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/, '#$1$1$2$2$3$3');
ok('1.47.1: every sub-tab colour has a text colour in the dark themes and one in the light themes (white or the dark ink)', ['rot', 'fuel', 'pen', 'dmg', 'tyre', 'wx', 'bop', 'tok', 'sc', 'ch'].every(k => ['#ffffff', '#10151b'].includes(onOf(strip, k)) && ['#ffffff', '#10151b'].includes(onOf(light, k))));
ok('1.47.1: ...and that text can be read on its colour (at least 3.5 to 1, dark and light themes)', ['rot', 'fuel', 'pen', 'dmg', 'tyre', 'wx', 'bop', 'tok', 'sc', 'ch'].every(k => contrast(varOf(strip, k), onOf(strip, k)) >= 3.5 && contrast(varOf(light, k), onOf(light, k)) >= 3.5));
ok('1.47.1: the card picture on a Race Setup page is the icon in the colour of the sub-tab on a tint of it (.ph.phicon), and the icon is drawn smaller than the tile', /\.ph\.phicon\{background:color-mix\(in srgb,var\(--c\) \d+%,var\(--panel\)\);color:var\(--c\)\}/.test(css) && /\.ph\.phicon svg\{width:\d+%/.test(css));
ok('compact navigation uses a 40px minimum control height and Escape restores focus to the menu summary', css.includes('min-height:40px') && editor.includes("e.key==='Escape'") && editor.includes("details.querySelector('summary').focus()"));
ok('the buttons can be reached with the keyboard and show where they are (a focus ring)', /\.ssbig:focus-visible,\.sstab:focus-visible\{outline:3px solid/.test(css));
ok('the mock-ups are kept with the code: the three pictures and their sources', ['1-option-a-top-strip.png', '2-option-a-states.png', '3-option-b-side-rail.png'].every(f => fs.existsSync(path.join(__dirname, '..', 'docs/ui-reference/race-setup-tabs', f))) && ['Main', 'A-States', 'B-SideRail'].every(f => fs.existsSync(path.join(__dirname, '..', 'docs/ui-reference/race-setup-tabs/source', f + '.dc.html'))));

// 1.51.0: the sub-tabs of the other main tabs have the same buttons, without the colours
{ const app = fs.readFileSync(R + 'app.js', 'utf8'), dbjs = fs.readFileSync(R + 'database.js', 'utf8');
  const bars = [[app, 'settingstabs'], [app, 'hwtabs'], [dbjs, 'subtabs'], [dbjs, 'respool'], [editor, 'customtabs']];
  ok('1.51.0: the five other bars of sub-tabs (Database, Results and Records, Customization, App Settings, Timing Hardware) are a .sub with role tablist, and nothing of their look is written in the page any more (it is in the style sheet)', bars.every(([src, id]) => new RegExp(`<div class="sub" id="${id}" role="tablist"></div>`).test(src)) && !/role="tablist" style=/.test(app + dbjs + editor));
  const rule = sel => (css.match(new RegExp('(?:^|\\n)' + sel.replace(/[.[\]()*+?^$|\\"=]/g, '\\$&') + '\\{([^}]*)\\}')) || [, ''])[1];
  const bar = rule('.sub[role="tablist"]'), chip = rule('.sub[role="tablist"] .tab'), hov = rule('.sub[role="tablist"] .tab:hover'), sel = rule('.sub[role="tablist"] .tab[aria-selected="true"]');
  const same = (a, b, props) => props.every(k => { const g = t => ((t.match(new RegExp('(?:^|;)' + k + ':([^;]*)')) || [])[1] || '').trim(); return g(a) && g(a) === g(b); });
  const sstab = rule('.sstab'), sshov = rule('.sstab:hover'), sssel = rule('.sstab[aria-selected="true"]');
  ok('1.51.0: they are buttons with the shape of the Race Setup chips: the same corners, size of text, spacing, border and tint', same(chip, sstab, ['border-radius', 'font-size', 'line-height', 'color', 'background', 'border']) && /padding:7px 13px/.test(chip) && /border-radius:8px/.test(chip) && /font-size:13\.5px/.test(chip));
  ok('1.51.0: ...with the same hover and the same stronger look for the one that is open (a stronger tint, its own border, a bar under it, bold)', same(hov, sshov, ['background']) && same(sel, sssel, ['background', 'border-color', 'box-shadow', 'font-weight']) && /box-shadow:inset 0 -3px 0 var\(--c\)/.test(sel) && /font-weight:700/.test(sel));
  ok('1.51.0: ...and they wrap onto a second line in a narrow window, with a small gap between them', /display:flex/.test(bar) && /flex-wrap:wrap/.test(bar) && /gap:6px/.test(bar));
  ok('1.51.0: ...without a colour of their own: their --c is the text colour of the theme on the panel, and no colour code or accent colour is written in these rules (so every theme, also your own, has them)', /--c:color-mix\(in srgb,var\(--ink\) \d+%,var\(--panel\)\)/.test(bar) && ![bar, chip, hov, sel].some(r => /#[0-9a-fA-F]{3,6}\b|var\(--accent\)|var\(--c-/.test(r)));
  ok('1.51.0: the main tabs along the top keep their underline (the new rules only apply inside a .sub bar)', /\.tab\{[^}]*border-bottom:3px solid transparent/.test(css) && /\.tab\[aria-selected="true"\]\{[^}]*border-bottom-color:var\(--accent\)/.test(css) && !/\n\.tab\{[^}]*border-radius/.test(css));
  ok('1.51.0: the old rule that only wrapped these bars on a narrow window is gone (they always wrap now)', !/@media \(max-width:700px\)\{\.sub\[role="tablist"\]\{flex-wrap:wrap\}\}/.test(css));
  // the buttons themselves are still made by renderTabs: a button with role tab, its name, and exactly one that is open
  const rt = app.slice(app.indexOf('function renderTabs'), app.indexOf('\n}\n', app.indexOf('function renderTabs')) + 3);
  const el = {}, tctx = vm.createContext({ Icons: { has: () => false }, esc: x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;'), raceTabTitle: () => '', el });
  vm.runInContext(rt + '\nel.f = renderTabs;', tctx);
  const box = {}; el.f(box, [['tracks', 'Tracks'], ['drivers', 'Drivers'], ['results', 'Results and Records']], 'drivers', () => {});
  ok('1.51.0: a bar of sub-tabs still has real buttons with role tab and the name of the page, and only the open page is selected', (box.innerHTML.match(/<button class="tab" role="tab"/g) || []).length === 3 && (box.innerHTML.match(/aria-selected="true"/g) || []).length === 1 && /aria-selected="true" data-id="drivers">Drivers</.test(box.innerHTML) && box.innerHTML.includes('>Results and Records<'));
}

// 1.58.2: Fuel Systems (it was Fuel Setups, in the Setups group) sits with the other systems, after the Damage Systems
{ const g = Object.fromEntries(ctx.out.groups.map(([name, items]) => [name, items.map(t => t[0])]));
  ok('1.58.2: Fuel Systems is in the Systems group, between Damage Systems and Tyre Wear Systems (and so the Setups group is Rotation Setups and Championships)', g.Systems.join() === 'fuel,penalties,damage,safetycar,tyrewear,weather,pushsave' && g.Setups.join() === 'rotation,championships');
  const fb = buttons(html('fuel')).find(x => x.id === 'fuel');
  ok('...the chip says Fuel Systems and keeps its id, its picture and its green', fb && fb.text === 'Fuel Systems' && fb.cls === 'sstab ss-fuel' && fb.inner.includes('<svg') && ctx.out.color('fuel') === 'fuel');
  const sch = require(path.join(R, '..', 'schema.js'));
  ok('...and the records are called Fuel systems everywhere: the table, the form, and the field of the race setup', sch.fuelrules.label === 'Fuel system' && sch.fuelrules.plural === 'Fuel systems' && sch.racesetups.fields.find(x => x.key === 'fuelRules').label === 'Fuel System');
  ok('...the page note of the tab says fuel system, and no text of the app calls it a fuel setup any more', /sub === 'fuel' \? 'A Fuel System sets the tank/.test(editor) && ['renderer/editor.js', 'renderer/help.js', 'renderer/bopui.js', 'schema.js'].every(f => !/fuel setup/i.test(fs.readFileSync(path.join(R, '..', f), 'utf8')))); }

if (fails) { console.log(fails + ' SETUP STRIP TESTS FAILED'); process.exit(1); }
console.log('ALL SETUP STRIP TESTS PASSED');
