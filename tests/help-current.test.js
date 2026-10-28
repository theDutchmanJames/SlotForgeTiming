// Current Help is product guidance, not a historical changelog. Keep it short
// and tied to the names and workflows users see in the application today.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const root = path.join(__dirname, '..');
const Help = require(path.join(root, 'renderer/help.js'));
const plain = html => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const source = file => fs.readFileSync(path.join(root, file), 'utf8');
const folders = Help.folders(), folder = id => folders.find(x => x.id === id);
const words = id => plain(folder(id).body);

assert.equal(Help.SECTIONS.length, 4, 'Help keeps its four top-level sections');
assert.equal(new Set(folders.map(x => x.id)).size, folders.length, 'every Help folder has a unique id');
assert(folders.every(x => x.title.length > 3 && x.note.length > 5 && /<li>/.test(x.body)), 'every folder has a useful title, note and task-focused content');
assert(folders.every(x => plain(x.body).length < 1400), 'every Help folder stays under the at-a-glance wording cap');

assert(words('results').includes('red flag') && words('results').includes('Track Record'), 'records explain invalid and red-flag laps');
assert(words('charteditor').includes('Charts → Race Chart') && words('charteditor').includes('Layout Editor') && words('charteditor').includes('Delta Trend'), 'Chart Editor explains the separate editor and widget workflow');
assert(words('chartoptions').includes('red-flag') && words('chartoptions').includes('second display') && words('chartoptions').includes('display-only'), 'chart Help explains eligibility, shared designs and display-only behavior');
assert(words('calculations').includes('Median lap') && words('calculations').includes('Track target'), 'Calculations explains the selectable benchmark');
assert(words('servicestop').includes('Penalty time always adds afterward') && words('servicestop').includes('Release car'), 'Service Stop explains its timer and release flow');
assert(words('setups').includes('Race Settings') && words('setups').includes('Start Lights Off Timer') && words('setups').includes('Race UI and Audio'), 'Race Setup Help follows the current page structure');
assert(words('setupwords').includes('In plain words') && words('setupwords').includes('Service Stop') && words('setupwords').includes('Used by'), 'the setup rail and its summary are explained');
assert(words('start').includes('Red Flag Restart Behaviour') && words('start').includes('First Lap Behaviour'), 'starting Help uses the current controls');
assert(words('screen').includes("Director's Final Check") && words('screen').includes('Victory Spotlight'), 'the finished-race flow is explained');
assert(words('fuel').includes('empty-to-full') && words('fuel').includes('Push & Save'), 'Fuel Help explains the revised pace hand-off');
assert(words('tyrewear').includes('median lap') && words('tyrewear').includes('Lasts about'), 'Tyre Wear Help explains pace-based wear and the simpler tyre editor');
assert(words('pushsave').includes('Full push') && words('pushsave').includes('Full save') && words('pushsave').includes('Which Laps Count'), 'Push & Save Help explains the interactive pace curve');
assert(words('custom').includes('Victory Spotlight') && words('custom').includes('Championship points'), 'Customization explains Race Results configuration');
assert(words('parallel').includes('InpOut driver') && words('parallel').includes('polling gaps'), 'Parallel Port Help retains its installation and diagnostics caveats');

const all = plain(Help.html());
for (const tab of ['Calculations', 'Race Results', 'Parallel Port', 'Timing Hardware', 'Layout Editor']) assert(all.includes(tab), `Help names ${tab}`);
for (const [name, file] of [['Calculations', 'renderer/app.js'], ['Race Results', 'renderer/editor.js'], ['Parallel Port', 'renderer/parallelpage.js']]) assert(source(file).includes(name), `${name} Help points to a current application screen`);

const html = Help.html();
assert(html.includes('data-system="fuel"') && html.includes('data-system="weather"') && html.includes('data-system="tyrewear"'), 'race-system Help folders retain their colour identity');
assert((html.match(/<details class="dbfolder helpfolder"/g) || []).length === folders.length, 'every folder renders in the shared folder style');

const kids = folders.map(f => ({ dataset: { help: f.id }, open: false, ontoggle: null }));
const box = { innerHTML: '', onclick: null, querySelectorAll: selector => /helpfolder/.test(selector) ? kids : [] };
Help.render(box);
assert(box.innerHTML.includes('helpwelcome') && kids.every(k => typeof k.ontoggle === 'function'), 'Help renders its welcome and remembers folder interactions');
kids[0].open = true; kids[0].ontoggle();
assert(Help.opened.has(folders[0].id), 'opening a folder is remembered');
box.onclick({ target: { closest: () => ({ dataset: { helpall: '0' } }) } });
assert.equal(Help.opened.size, 0, 'Close all clears opened Help folders');

console.log('Current Help: passed.');
