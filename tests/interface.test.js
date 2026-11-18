'use strict';
// Phase 4 (interface, 2.3.0): the contrast of every ready-made theme, searching App Settings, pairing a phone with the Race Director by QR code,
// and the systems a club hides in Race Setup.
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  http = require('node:http');
const Theme = require('../renderer/theme.js'),
  SI = require('../renderer/settingsindex.js'),
  { createServer } = require('../server.js');
const R = path.join(__dirname, '..', 'renderer');
const css = fs.readFileSync(path.join(R, 'styles.css'), 'utf8');

// ---- contrast (WCAG AA: 4.5:1 for normal text) ----
function themes() {
  const out = {},
    re = /^\[data-theme="([a-z]+)"\]\{([^}]*)\}/gm;
  let m;
  while ((m = re.exec(css)))
    out[m[1]] = Object.fromEntries(
      m[2]
        .split(';')
        .filter(Boolean)
        .map(p => p.split(':'))
        .map(([k, v]) => [k.replace(/^--/, ''), Theme.hex6(v)])
    );
  return out;
}
test('every ready-made theme has readable text: normal, quiet, in the accent colour, and on accent buttons', () => {
  const all = themes();
  assert.deepEqual(
    Object.keys(all).sort(),
    Theme.THEMES.map(t => t[0])
      .filter(t => t !== 'custom')
      .sort()
  );
  for (const [name, c] of Object.entries(all)) {
    const text = c['accent-text'] || c.accent,
      fill = c['accent-fill'] || c.accent;
    const pairs = [
      ['ink', c.ink, 'bg', c.bg],
      ['ink', c.ink, 'panel', c.panel],
      ['muted', c.muted, 'panel', c.panel],
      ['muted', c.muted, 'bg', c.bg],
      ['accent text', text, 'panel', c.panel],
      ['accent text', text, 'bg', c.bg],
      ['button text', c['on-accent'], 'accent button', fill]
    ];
    for (const [a, x, b, y] of pairs)
      assert(Theme.ratio(x, y) >= 4.5, `${name}: ${a} on ${b} is ${Theme.ratio(x, y).toFixed(2)}:1, under 4.5:1`);
  }
});
test('the accent as a text colour and as the fill behind button text go through their own colours', () => {
  for (const name of fs.readdirSync(R).filter(n => n.endsWith('.css'))) {
    const s = fs.readFileSync(path.join(R, name), 'utf8');
    assert(!/(^|[;{\s])color:var\(--accent\)/.test(s), name + ': text in the accent colour uses --accent-text');
    for (const rule of s.match(/\{[^{}]*color:var\(--on-accent\)[^{}]*\}/g) || [])
      assert(!/background:var\(--accent\)/.test(rule), name + ': a fill behind on-accent text uses --accent-fill: ' + rule);
  }
  assert(css.includes(':where(button,summary,a[href]'), 'a focus ring for everything that takes the keyboard');
  assert(css.includes('@media (prefers-reduced-motion:reduce)'));
});

// ---- searching App Settings ----
test('the settings search finds a setting by a few words in any order, with its page, pages first', () => {
  const r = SI.search('pause ds');
  assert.equal(r[0].t, 'When the race is paused');
  assert.equal(r[0].where, 'Timing Hardware › DS Electronics');
  assert.equal(SI.search('timing hard')[0].k, 'page');
  assert.deepEqual(SI.search('  '), []);
  assert.deepEqual(SI.search('xyzzy'), []);
  assert(SI.search('backup').some(e => e.t === 'Automatic backups'));
  assert(SI.search('pair').some(e => e.t === 'Pair a phone'));
  assert(SI.search('e', 99).length <= 99);
});
test('every word of the settings search is still on its page (a renamed setting is noticed: refresh the index with tools/settings-index)', () => {
  const read = d =>
    fs
      .readdirSync(d)
      .filter(n => /\.(js|html)$/.test(n) && n !== 'settingsindex.js')
      .map(n => fs.readFileSync(path.join(d, n), 'utf8'))
      .join('\n');
  const src = read(R) + read(path.join(R, 'database'));
  const composed = new Set([
    'Save Push & Save calculation',
    'Edit all push and save system rules',
    'Create push and save system',
    'Edit all tyre wear system rules',
    'Create tyre wear system'
  ]); // (put together from the name of the system while the page runs)
  const missing = SI.ENTRIES.filter(e => !composed.has(e.t) && !src.includes(e.t) && !src.includes(e.t.replace(/&/g, '&amp;'))).map(
    e => e.t
  );
  assert.deepEqual(missing, []);
});

// ---- pairing a phone by QR code ----
function serve(settings) {
  const s = createServer({
    getSettings: () => settings,
    schema: {},
    getLive: () => ({}),
    list: async () => [],
    customFields: async () => [],
    onCommand: async () => {},
    root: R,
    appRoot: path.join(__dirname, '..'),
    failDelay: 1,
    lockMs: 1
  });
  return s.listen(0, '127.0.0.1').then(port => ({ s, port }));
}
const post = (port, p, data) =>
  new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: p,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          Host: '127.0.0.1:' + port,
          Origin: 'http://127.0.0.1:' + port
        }
      },
      res => {
        let t = '';
        res.on('data', c => (t += c));
        res.on('end', () => resolve({ code: res.statusCode, body: JSON.parse(t || '{}') }));
      }
    );
    req.on('error', reject);
    req.end(body);
  });

test('a pairing code logs one device in, once; a wrong or used one is refused; no password, no pairing', async () => {
  const settings = { netPassword: 'club' };
  const { s, port } = await serve(settings);
  try {
    const p = s.pairing();
    assert.match(p.code, /^[0-9a-f]{32}$/);
    assert(Date.parse(p.expiresAt) > Date.now());
    const ok = await post(port, '/api/pair', { code: p.code });
    assert.equal(ok.code, 200);
    assert.match(ok.body.token, /^[0-9a-f]{48}$/);
    const cmd = await post(port, '/api/command', { token: ok.body.token, cmd: { type: 'nonsense' } });
    assert.equal(cmd.code, 400, 'the token is a login: the command itself is what is refused');
    assert.equal((await post(port, '/api/pair', { code: p.code })).code, 401, 'once');
    assert.equal((await post(port, '/api/pair', { code: 'f'.repeat(32) })).code, 401);
    const q = s.pairing();
    settings.netPassword = 'changed';
    assert.equal((await post(port, '/api/pair', { code: q.code })).code, 401, 'a changed password makes the codes of the old one useless');
    settings.netPassword = '';
    assert.equal(s.pairing(), null);
    assert.equal((await post(port, '/api/pair', { code: q.code })).code, 403);
  } finally {
    await s.close();
  }
});

test('the phone side: the code goes from the address before anything else, and the Race Director opens', () => {
  const web = fs.readFileSync(path.join(R, 'webapi.js'), 'utf8'),
    lv = fs.readFileSync(path.join(R, 'liveview.js'), 'utf8');
  assert(
    web.indexOf("history.replaceState(null, '', location.pathname + location.search + '#live')") <
      web.indexOf("if (!location.hash) location.hash = '#live'")
  );
  assert(lv.includes('await api.pairing();') && lv.includes('page = api.startPage();'));
  assert(css.includes('#lv-dir>.lv-ctl{position:sticky'), 'on a phone the race controls stay at the top');
});

// ---- Race Setup: the systems a club uses ----
test('hidden Race Setup systems leave the strip and the race setup form, unless a setup uses one', () => {
  const src = fs.readFileSync(path.join(R, 'editor.js'), 'utf8'),
    db = fs.readFileSync(path.join(R, 'database.js'), 'utf8');
  for (const k of [
    'fuelRules',
    'penaltySystem',
    'damageSystem',
    'safetyCar',
    'tyreWear',
    'weather',
    'pushSave',
    'bop',
    'multiClass',
    'resourceSystem'
  ])
    assert(src.includes(`: '${k}'`), k);
  const schemaKeys = require('../schema.js').racesetups.fields.map(f => f.key);
  for (const m of src.matchAll(/^\s+[a-z]+: '([A-Za-z]+)',?$/gm))
    if (/System|Rules|safetyCar|tyreWear|weather|pushSave|bop|multiClass/.test(m[1])) assert(schemaKeys.includes(m[1]), m[1]);
  assert(db.includes('hide.includes(fields[i].key) && !has(fields[i].key)'));
});

// 2.4.0 Broadcast Home: the lane cards of Start a race stand side by side for 1 to 3 lanes and in two rows from 4 lanes on, at most 4 in a row.
test('Home lays out 1 to 8 lanes in one row or two', () => {
  const src = fs.readFileSync(path.join(R, 'landing.js'), 'utf8'),
    line = src.match(/^const laneCols = .*$/m);
  assert(line, 'landing.js has laneCols');
  const laneCols = new Function(line[0] + '; return laneCols;')();
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 12].map(laneCols), [1, 2, 3, 4, 3, 3, 4, 4, 4]);
  assert.match(src, /class="hs-lanes" data-cols="\$\{laneCols\(rows\.length\)\}"/);
  assert.match(src, /<div class="hm-hero\$\{heroCls\}">/);
  const css = fs.readFileSync(path.join(R, 'styles.css'), 'utf8');
  for (const n of [2, 3, 4]) assert(css.includes(`#hmc-start .hs-lanes[data-cols="${n}"]{--hs-cols:${n}}`), `${n} columns`);
});
