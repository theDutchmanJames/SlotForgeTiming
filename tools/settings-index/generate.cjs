// Writes renderer/settingsindex.js (the settings search of App Settings) from a harvest of the App Settings pages.
// To refresh it after settings changed: open the app with remote debugging, run harvest.js in the main window (it opens every App Settings page and
// collects the words: section titles, setting labels and buttons) and save its JSON answer; then: node tools/settings-index/generate.cjs . harvest.json, and npm run format
const fs = require('fs'),
  path = require('path');
const repo = process.argv[2];
const raw = JSON.parse(fs.readFileSync(process.argv[3] || 'harvest.json', 'utf8'));
const bad = /\d+ ticked|^Use .* for races$|\.\.\.$|\(\d+\.\d+\.\d+\)|\d{4,} baud|^Lane \d+ /; // (words made while the page runs: counts, versions, a speed, a lane)
const PAGES = [
  ['general', 'General'],
  ['theme', 'App Theme'],
  ['director', 'Race Director'],
  ['calculations', 'Calculations'],
  ['network', 'Connections'],
  ['hardware', 'Timing Hardware'],
  ['transfer', 'Import and Export'],
  ['plugins', 'Plugins']
];
const SUBS = {
  race: 'Race Sharing',
  dealership: 'Dealership Mode',
  library: 'Shared Library',
  trackmate: 'Trackmate Interface',
  arduino: 'Arduino Sketch',
  parallel: 'Parallel Port',
  ds: 'DS Electronics',
  plugin: 'Plugin interface'
};
const entries = [];
const seen = new Set();
const push = e => {
  const key = e.t.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  entries.push(e);
};
for (const [s, name] of PAGES) push({ t: name, k: 'page', s });
for (const [id, name] of Object.entries(SUBS))
  push(
    ['race', 'dealership', 'library'].includes(id)
      ? { t: name, k: 'page', s: 'network', ct: id }
      : { t: name, k: 'page', s: 'hardware', hw: id }
  );
for (const x of raw) {
  if (bad.test(x.text)) continue;
  if (x.text.startsWith('Timing hardware in use')) x.text = 'Timing hardware in use'; // (its question is a second line of the same label)
  const e = { t: x.text, k: x.kind[0], s: x.sub };
  if (x.hwSub) e.hw = x.hwSub;
  if (x.connectionsTab) e.ct = x.connectionsTab;
  push(e);
}
const body = `// The settings search of App Settings (2.3.0): every section title, setting and button of the App Settings pages, and where it is.
// Made from the pages themselves (the app was opened on every page and their words were collected); tests/settingssearch.test.js checks that
// each one is still in the source, so a renamed setting is noticed. search() finds them by the words typed, in any order.
(function (root) {
  // t: the words on the page; k: 'page', 's' (a section or a setting), 'a' (a button); s: the App Settings page; hw: the Timing Hardware page; ct: the Connections page
  const ENTRIES = ${JSON.stringify(entries, null, 0).replace(/\},\{/g, '},\n    {').replace(/^\[/, '[\n    ').replace(/\]$/, '\n  ]')};
  const PAGE = ${JSON.stringify(Object.fromEntries(PAGES))};
  const SUB = ${JSON.stringify(SUBS)};
  const norm = t =>
    String(t || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\\u0300-\\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  // where an entry is, in words: "Timing Hardware › DS Electronics"
  const where = e => [PAGE[e.s], SUB[e.hw] || SUB[e.ct]].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' › ');
  const WORDS = ENTRIES.map(e => norm(e.t + ' ' + where(e)).split(' ')); // (the page counts too: "ds pause")
  // every typed word must start a word of the entry; pages first, then sections and settings, then buttons; shorter first
  function search(q, max = 12) {
    const words = norm(q).split(' ').filter(Boolean);
    if (!words.length) return [];
    const rank = { page: 0, s: 1, a: 2 };
    return ENTRIES.map((e, i) => ({ e, i }))
      .filter(({ i }) => words.every(w => WORDS[i].some(x => x.startsWith(w))))
      .sort((a, b) => rank[a.e.k] - rank[b.e.k] || a.e.t.length - b.e.t.length || a.i - b.i)
      .slice(0, max)
      .map(({ e }) => ({ ...e, where: where(e) }));
  }
  const api = { ENTRIES, search, where, norm };
  root.SettingsIndex = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
`;
fs.writeFileSync(path.join(repo, 'renderer', 'settingsindex.js'), body);
console.log(entries.length + ' entries');
