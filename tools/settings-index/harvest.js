// Runs inside the main window of the app (for instance through the remote debugging port): opens every App Settings page and returns the words
// of its sections, settings and buttons as JSON, for generate.cjs. It only reads: nothing is changed or saved.
document.querySelector('dialog[open]')?.close();
const w = ms => new Promise(r => setTimeout(r, ms));
const pages = [
  ['general', {}],
  ['theme', {}],
  ['director', {}],
  ['calculations', {}],
  ['network', { connectionsTab: 'race' }],
  ['network', { connectionsTab: 'dealership' }],
  ['network', { connectionsTab: 'library' }],
  ['hardware', { hwSub: 'trackmate' }],
  ['hardware', { hwSub: 'arduino' }],
  ['hardware', { hwSub: 'parallel' }],
  ['hardware', { hwSub: 'ds' }],
  ['hardware', { hwSub: 'plugin' }],
  ['transfer', {}],
  ['plugins', {}]
];
const clean = t =>
  String(t || '')
    .replace(/\s+/g, ' ')
    .replace(/[:…]+$/, '')
    .trim();
const own = el => {
  // the words of a label without the options of a select inside it
  const c = el.cloneNode(true);
  c.querySelectorAll('select,option,input,textarea,.hint,small,span.muted').forEach(x => x.remove());
  return clean(c.textContent);
};
const out = [];
const seen = new Set();
for (const [sub, extra] of pages) {
  state.tab = 'settings';
  state.settingsSub = sub;
  if (extra.hwSub) state.hwSub = extra.hwSub;
  if (extra.connectionsTab) connectionsTab = extra.connectionsTab;
  await render();
  await w(1500);
  const box = document.getElementById('settingsbox');
  
  const add = (text, kind) => {
    text = clean(text);
    if (!text || text.length < 3 || text.length > 90 || seen.has(text)) return;
    seen.add(text);
    out.push({ text, kind, sub, ...extra });
  };
  box.querySelectorAll('h2, h3, h4, legend, details > summary strong, details > summary b, .tm-nav b, .hp-nav b').forEach(e => add(e.textContent.replace(/^[^A-Za-z0-9]+/, ''), 'section'));
  box.querySelectorAll('label').forEach(l => {
    if (!l.closest('.trlist,.trdep,.trent,.netlist')) add(own(l), 'setting');
  });
  box.querySelectorAll('button').forEach(b => {
    if (b.querySelector('b,strong,small')) return; // (a section of the page: its title is collected above)
    const t = clean(b.textContent).replace(/^[^A-Za-z0-9]+/, '');
    if (t.length > 6 && !/^(Open all|Close all|Cancel|Save|Done|OK|Previous|Next|Connect|Disconnect.*|Save log|Copy log|Clear)$/.test(t)) add(t, 'action');
  });
}
return JSON.stringify(out);
