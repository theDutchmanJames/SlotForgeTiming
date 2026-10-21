// The frame of the Race Setup form with a rail (1.71.0, renderer/railform.js): the header, the rail with a note and a dot for every section, the sections that fold, the box Used by and the bar with Cancel and Save.
// Pure functions that make HTML and draw the notes and the dots, so they are tested here without a screen. The settings in the sections are not part of it: the form passes them in as HTML.
const R = require('../renderer/railform.js'), Icons = require('../renderer/icons.js'), schema = require('../schema.js');
let fails = 0; const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const icon = n => '<svg data-icon="' + n + '"></svg>';
const IDS = 'session,heats,length,endurance,start,rules,screens,advanced'.split(',');
const secs = IDS.map((id, i) => ({ id, title: 'T' + id, ask: 'Q ' + id + '?', icon: 'rules', open: i < 3, optional: id === 'advanced', body: `<div class="fgrid"><input data-key="k${id}"></div>` }));
const base = { eyebrow: 'Add race setup', tile: '<svg></svg>', name: '<input id="f-name" data-key="name">', sections: secs, icon, used: null, say: '<p>A race.</p>', cls: 'setupform ss-race' };
const html = R.shell(base);
const count = (s, sub) => s.split(sub).length - 1;

// ---- the frame ----
ok('the frame is one form (id frm) with the classes it is given, a header, a body with the rail and the main part, and a footer, in that order', html.startsWith('<form id="frm" class="rsform setupform ss-race">') && html.endsWith('</form>')
  && html.indexOf('<header class="rshd">') < html.indexOf('<div class="rsbody">') && html.indexOf('<div class="rsbody">') < html.indexOf('<footer class="rsfoot">') && count(html, '<form ') === 1);
ok('...the header has the picture of the kind, the name (a field that the form reads), the pills and Ready to race, with the ids the form draws into', ['id="rstile"', 'id="rshead"', 'id="rspills"', 'id="rsready"'].every(x => html.includes(x)) && html.includes('<input id="f-name" data-key="name">')
  && html.indexOf('id="rstile"') < html.indexOf('id="rshead"') && html.indexOf('id="rshead"') < html.indexOf('id="f-name"') && html.indexOf('id="f-name"') < html.indexOf('id="rspills"') && html.indexOf('id="rspills"') < html.indexOf('id="rsready"') && html.includes('>Add race setup</h3>'));
ok('...the sentence In plain words (a live region) is the first thing of the main part, above the sections', html.includes('<div class="rsmain"><div class="rssay" id="rssay" aria-live="polite"><p>A race.</p></div><details') && html.indexOf('id="rssay"') < html.indexOf('<details'));
ok('...the footer has the error line (an alert), Cancel (a button that does not submit), Save (the submit), and the line that everything else keeps its default', html.includes('<p class="error" id="err" role="alert"></p>') && html.includes('<button class="btn" type="button" id="cancel">Cancel</button>')
  && html.includes('<button class="btn primary" type="submit">Save race setup</button>') && html.includes('Everything else keeps its default.') && count(html, 'type="submit"') === 1);
ok('...and without a class, a name or a picture there is no "undefined" and no extra space', (() => { const h = R.shell({ eyebrow: 'Edit race setup', name: '', sections: secs, icon }); return h.startsWith('<form id="frm" class="rsform">') && !/undefined|null/.test(h); })());

// ---- the sections ----
ok('every section is a folding card with its id, its picture, its title, the question it answers and a place for the note of the closed state; the settings follow the header', IDS.every(id => html.includes(`<details class="fgroup rssec" data-fg="${id}"`) && html.includes(`id="rs-row-${id}"`) && html.includes(`<strong>T${id}</strong>`) && html.includes(`<span class="muted rsq">Q ${id}?</span>`)
  && html.includes(`<input data-key="k${id}">`)) && count(html, '<details ') === 8 && count(html, '<summary>') === 8 && count(html, '</details>') === 8 && html.includes('<summary><span class="rsic"><svg data-icon="rules"></svg></span>'));
ok('...the first three are open, the others closed, as the form says', IDS.map(id => new RegExp(`data-fg="${id}" open>`).test(html) ? 1 : 0).join('') === '11100000');
ok('...the sections come in the order that they were given', IDS.every((id, i) => i === 0 || html.indexOf(`data-fg="${id}"`) > html.indexOf(`data-fg="${IDS[i - 1]}"`)));
ok('text from outside is made safe: a title, a question or a name with < > & or quotes cannot break the page', (() => { const h = R.shell({ ...base, eyebrow: '<b>x</b>', cls: 'a"b', sections: [{ id: 'x"y', title: '<i>T</i>', ask: 'A & B', icon: 'rules', body: '' }] }); return !h.includes('<b>x</b>') && !h.includes('<i>T</i>') && h.includes('&lt;i&gt;T&lt;/i&gt;') && h.includes('A &amp; B') && h.includes('class="rsform a&quot;b"') && h.includes('data-fg="x&quot;y"'); })());
ok('the parts of a section (Advanced) are small blocks with a title and a line, each one with its own data-fg (so one can be hidden), and the settings in a grid', (() => { const s = R.sub('yellow', 'Yellow flag', 'What it does.', '<i></i>'); return s === '<section class="rssub" data-fg="yellow"><h4 class="rssubt">Yellow flag</h4><p class="muted hint rssubn">What it does.</p><div class="fgrid"><i></i></div></section>' && !R.sub('pads', 'Pads', '', '').includes('<p') && R.grid('<b></b>') === '<div class="fgrid"><b></b></div>'; })());

// ---- the rail ----
{ const nav = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'));
  ok('the rail is a nav with a row for every section: a button with the id of the section, its picture, its title, a place for the note, a dot, and the dot in words for a screen reader', IDS.every(id => nav.includes(`<button type="button" class="rsri" id="rs-rail-${id}" data-rail="${id}">`) && nav.includes(`<small id="rs-note-${id}"></small>`) && nav.includes(`<i class="rsdot off" id="rs-dot-${id}" aria-hidden="true"></i>`)
    && nav.includes(`<span class="rssr" id="rs-state-${id}"></span>`) && nav.includes(`<b>T${id}</b>`)) && count(nav, '<button ') === 8 && nav.includes('aria-label="The sections of this race setup"'));
  ok('...the rows are under "This setup", and the sections that are optional (Advanced) are under "Only if you need it", after the others', nav.indexOf('This setup') < nav.indexOf('data-rail="session"') && nav.indexOf('data-rail="screens"') < nav.indexOf('Only if you need it') && nav.indexOf('Only if you need it') < nav.indexOf('data-rail="advanced"') && nav.includes('id="rs-optional"'));
  ok('...a form with no optional section has no heading "Only if you need it"', (() => { const h = R.shell({ ...base, sections: secs.map(s => ({ ...s, optional: false })) }); return !h.includes('Only if you need it') && !h.includes('rs-optional'); })()); }

// ---- Used by ----
ok('Used by: not drawn when it does not apply (a new setup, or the championships are not known), and a line that says so when no championship uses the setup', R.used(null) === '' && R.used(undefined) === '' && !html.includes('rs-used') && R.used([]).includes('No championship uses it yet') && R.used([]).includes('id="rs-used"') && R.shell({ ...base, used: [] }).includes('No championship uses it yet'));
ok('...it lists the championships by name (made safe), at most four, and says how many more', (() => { const u = R.used(['A', 'B<', 'C']), many = R.used(['1', '2', '3', '4', '5', '6']); return u.includes('<span class="rsun">A</span>') && u.includes('B&lt;') && !u.includes('B<') && count(u, 'rsun') === 3 && count(many, '"rsun"') === 4 && many.includes('and 2 more') && !many.includes('>5<'); })());
ok('...it is in the rail, below the rows', (() => { const h = R.shell({ ...base, used: ['Winter cup'] }); return h.indexOf('data-rail="advanced"') < h.indexOf('id="rs-used"') && h.indexOf('id="rs-used"') < h.indexOf('</nav>') && h.includes('Winter cup'); })());

// ---- the dots ----
ok('three states: green (filled in or changed), amber (something is missing), an open ring (nothing changed), each with words; an unknown state is a ring', R.stateOf('ok')[0] === 'ok' && R.stateOf('todo')[0] === 'todo' && R.stateOf('plain')[0] === 'off' && R.stateOf('nonsense')[0] === 'off' && R.stateOf(undefined)[0] === 'off'
  && R.STATES.ok[1] === 'Filled in or changed' && R.STATES.todo[1] === 'Something is missing' && R.STATES.plain[1] === 'Nothing changed from the standard');

// ---- drawing the notes and the dots into the form ----
const mkEl = () => { const el = { textContent: '', className: '', title: '', hidden: false, attrs: {}, on: false, classList: { toggle: (c, f) => { if (c === 'on') el.on = !!f; } }, setAttribute: (k, v) => { el.attrs[k] = v; }, removeAttribute: k => { delete el.attrs[k]; } }; return el; };
const els = {}; IDS.forEach(id => ['rs-note-', 'rs-row-', 'rs-dot-', 'rs-state-', 'rs-rail-'].forEach(p => { els[p + id] = mkEl(); })); els['rs-optional'] = mkEl();
const byId = k => els[k] || null;
const info = {}; IDS.forEach(id => { info[id] = { rail: 'note ' + id, row: 'Row ' + id, state: id === 'session' ? 'ok' : id === 'heats' ? 'todo' : 'plain' }; });
R.sync(byId, info, null, 'heats');
ok('the note goes into the rail, the longer line into the closed section, and the dot gets its colour and its words (hover and screen reader)', IDS.every(id => els['rs-note-' + id].textContent === 'note ' + id && els['rs-row-' + id].textContent === 'Row ' + id)
  && els['rs-dot-session'].className === 'rsdot ok' && els['rs-dot-session'].title === 'Filled in or changed' && els['rs-state-session'].textContent === 'Filled in or changed'
  && els['rs-dot-heats'].className === 'rsdot todo' && els['rs-state-heats'].textContent === 'Something is missing' && els['rs-dot-length'].className === 'rsdot off' && els['rs-dot-length'].title === 'Nothing changed from the standard');
ok('...the row of the current section is marked (on, aria-current), and only that one', els['rs-rail-heats'].on === true && els['rs-rail-heats'].attrs['aria-current'] === 'true' && IDS.filter(id => id !== 'heats').every(id => els['rs-rail-' + id].on === false && !('aria-current' in els['rs-rail-' + id].attrs)));
R.sync(byId, info, null, 'length');
ok('...and the mark moves with the current section', els['rs-rail-length'].on === true && els['rs-rail-heats'].on === false && !('aria-current' in els['rs-rail-heats'].attrs) && els['rs-rail-length'].attrs['aria-current'] === 'true');
R.sync(byId, info, { heats: false, advanced: false }, 'session');
ok('a section with nothing to show now is hidden in the rail, and the others stay (Advanced takes its heading "Only if you need it" with it)', els['rs-rail-heats'].hidden === true && els['rs-rail-advanced'].hidden === true && els['rs-optional'].hidden === true && els['rs-rail-session'].hidden === false && els['rs-rail-length'].hidden === false);
R.sync(byId, info, { heats: true, advanced: true }, 'session');
ok('...and comes back when it has something to show again', els['rs-rail-heats'].hidden === false && els['rs-rail-advanced'].hidden === false && els['rs-optional'].hidden === false);
ok('a form that has no rail (or only some of the elements, or nothing at all) is no problem', (() => { try { R.sync(() => null, info, null, 'session'); R.sync(k => (k === 'rs-note-session' ? els[k] : null), info, { session: true }, 'session'); R.sync(byId, null, null, 'x'); R.sync(byId, undefined); R.sync(byId, {}); R.sync(k => ({ textContent: '', classList: {} }), info, null, 'session'); return true; } catch (x) { console.log(x); return false; } })());

// ---- the rail of the schema and the pictures ----
{ const rail = schema.racesetups.rail, gids = schema.racesetups.groups.map(g => g.id);
  ok('the schema has the eight sections of the rail in the order of the form, each with a title, a question, a picture of the icon set, and the groups that it holds', rail.map(r => r.id).join() === IDS.join() && rail.every(r => r.title && r.ask && r.icon && Icons.PATHS[r.icon] && Array.isArray(r.groups) && r.groups.length) && rail.filter(r => r.optional).map(r => r.id).join() === 'advanced' && rail.filter(r => r.open).map(r => r.id).join() === 'session,heats,length');
  ok('...every group of the schema is in exactly one section (so every setting is drawn once), and the groups of the settings are the same as before 1.71.0 (eleven)', gids.length === 11 && rail.flatMap(r => r.groups).sort().join() === gids.slice().sort().join() && schema.racesetups.fields.every(f => gids.includes(f.group)));
  ok('...Advanced holds the yellow flag, the adjust pads, Trackmate and the SlotForge box, in that order', rail.find(r => r.id === 'advanced').groups.join() === 'yellow,pads,trackmate,box' && !rail.find(r => r.id === 'session').groups.includes('yellow'));
  ok('...every question of a section ends with a full stop or a question mark, and no two sections have the same title', rail.every(r => /[.?]$/.test(r.ask)) && new Set(rail.map(r => r.title)).size === rail.length); }

if (fails) { console.log(fails + ' RAIL FORM TESTS FAILED'); process.exit(1); } else console.log('ALL RAIL FORM TESTS PASSED');
