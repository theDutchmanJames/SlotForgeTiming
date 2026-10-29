// The installer (npm run dist) only contains the files listed in package.json: every file the app loads must be on that list.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
let fails = 0; const ok = (n, c) => { if (c) console.log('ok  ', n); else { console.log('FAIL', n); fails++; } };
const patterns = (pkg.build && pkg.build.files) || [];
const covered = rel => patterns.some(p => p === rel || (p === '*.js' && !rel.includes('/') && rel.endsWith('.js')) || (p.endsWith('/**') && rel.startsWith(p.slice(0, -2))));
// every local file the main process loads, followed from main.js
const seen = new Set(), queue = ['main.js'], missing = [];
while (queue.length) {
  const rel = queue.shift(); if (seen.has(rel)) continue; seen.add(rel);
  if (!covered(rel)) missing.push(rel);
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  for (const m of text.matchAll(/require\('(\.[^']+)'\)/g)) {
    let f = path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1])); if (!/\.\w+$/.test(f)) f += '.js';
    if (fs.existsSync(path.join(root, f))) queue.push(f);
  }
}
ok('every file the app loads at start is in the installer (' + [...seen].join(', ') + ')', missing.length === 0 && seen.has('transfer.js') && seen.has('backup.js'));
if (missing.length) console.log('  not in the installer:', missing.join(', '));
ok('main.js names the preload script and the pages it opens, and they are in the installer', ['preload.js', 'renderer/index.html'].every(covered));
const html = fs.readFileSync(path.join(root, 'renderer', 'index.html'), 'utf8');
const styles = [...html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)].map(m => m[1]).filter(s => !s.startsWith('../node_modules/'));
ok('every local stylesheet exists and is packaged, including shared tab styling', styles.includes('tabstyle.css') && styles.every(s => fs.existsSync(path.join(root, 'renderer', s)) && covered('renderer/' + s)));
const scripts = [...html.matchAll(/src="([^"]+)"/g)].map(m => m[1]).filter(s => !/^https?:|^node_modules/.test(s));
ok('every script of the page exists and is in the installer', scripts.length > 10 && scripts.every(s => fs.existsSync(path.join(root, 'renderer', s)) && covered('renderer/' + s)));
ok('the compiled Parallel Port helper and its source are packaged, and the executable is unpacked from ASAR', ['native/parallel/SlotForgeParallel.exe', 'native/parallel/SlotForgeParallel.cs', 'native/parallel/NOTICE-InpOut.txt', 'renderer/parallel.css'].every(f => fs.existsSync(path.join(root, f)) && covered(f)) && pkg.build.asarUnpack.includes('native/parallel/*.exe'));
const targets = ((pkg.build.win || {}).target || []).map(t => (typeof t === 'string' ? t : t.target));
ok('the Windows build makes an installer and a portable program', targets.includes('nsis') && targets.includes('portable') && /Setup/.test((pkg.build.nsis || {}).artifactName || '') && /Portable/.test((pkg.build.portable || {}).artifactName || ''));
const mainText = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
{ // the screens ask the main program through the preload script: every channel it calls has a handler in main.js, and every handler is called by something
  const pre = fs.readFileSync(path.join(root, 'preload.js'), 'utf8'), asks = [...pre.matchAll(/call\('([^']+)'/g)].map(m => m[1]), handles = [...mainText.matchAll(/ipcMain\.handle\('([^']+)'/g)].map(m => m[1]);
  handles.push(...[...fs.readFileSync(path.join(root,'packipc.js'),'utf8').matchAll(/(?:^|\n)\s*handle\('([^']+)'/g)].map(m=>'packs:'+m[1]));
  handles.push(...[...fs.readFileSync(path.join(root,'pluginipc.js'),'utf8').matchAll(/(?:^|\n)\s*handle\('([^']+)'/g)].map(m=>'plugins:'+m[1]));
  ok('every call of the preload script has a registered main-process handler (' + asks.length + ' channels), and none is left without a caller', asks.length > 20 && asks.every(c => handles.includes(c)) && handles.every(c => asks.includes(c)) && new Set(asks).size === asks.length);
  ok('the extra fields can be listed, added, deleted and moved to another group from a screen', ['custom:list', 'custom:add', 'custom:remove', 'custom:group'].every(c => asks.includes(c) && handles.includes(c)) && /setCustomFieldGroup: \(entity, id, group\) => call\('custom:group', entity, id, group\)/.test(pre) && /ipcMain\.handle\('custom:group', async \(_e, entity, id, group\) => \{ const f = db\.setCustomFieldGroup\(entity, id, group\); await db\.saved\(\); return f; \}\)/.test(mainText)); }
ok('the data folder is fixed (the same for npm start, the installed app and the portable program) and only one copy can run', /setPath\('userData'/.test(mainText) && /requestSingleInstanceLock/.test(mainText));
const bat = fs.existsSync(path.join(root, 'build-windows.bat')) ? fs.readFileSync(path.join(root, 'build-windows.bat'), 'utf8') : '';
ok('build-windows.bat exists, uses Windows line endings and runs the build', /npm run dist/.test(bat) && /\r\n/.test(bat) && /npm install --save-dev electron electron-builder/.test(bat));
const batQuick = fs.existsSync(path.join(root, 'build-windows-quick.bat')) ? fs.readFileSync(path.join(root, 'build-windows-quick.bat'), 'utf8') : '';
ok('build-windows-quick.bat exists, uses Windows line endings and only starts build-windows.bat with quick', /\r\n/.test(batQuick) && !/(?<!\r)\n/.test(batQuick) && batQuick.split('\r\n').filter(l => l.trim() && !/^(@echo off|rem )/i.test(l)).length === 1 && /^call "%~dp0build-windows\.bat" quick$/m.test(batQuick.replace(/\r/g, '')) && !/\bnpm\b.*\b(test|install)\b/.test(batQuick.replace(/^rem .*$/gim, '')));
ok('build-windows.bat has the quick way: it skips the check of the app (npm test), and the building blocks when all three are already here', /if \/i "%~1"=="quick"/.test(bat) && /if \/i "%~1"=="\/quick"/.test(bat) && /if \/i "%~1"=="--quick"/.test(bat) && /if not "%QUICK%"=="1" goto getblocks/.test(bat) && ['electron', 'electron-builder', 'flag-icons'].every(b => bat.includes('if not exist "node_modules\\' + b + '\\package.json" goto getblocks')) && /if "%QUICK%"=="1" goto skipcheck/.test(bat));
{ // the order of the steps in build-windows.bat, followed like the command prompt does: which commands run in a normal build, and in a quick one with and without the blocks
  const lines = bat.split('\r\n'), labels = {}; lines.forEach((l, i) => { const m = /^:(\w+)/.exec(l); if (m) labels[m[1]] = i; });
  const walk = (quick, haveBlocks) => {
    const ran = [], exists = f => haveBlocks && /^node_modules\\(electron|electron-builder|flag-icons)\\package\.json$/.test(f); let i = 0, guard = 0, depth = 0;
    while (i < lines.length && guard++ < 500) {
      const l = lines[i].trim(); i++;
      if (/^exit \/b/.test(l) && depth === 0) { ran.push('exit'); break; }
      if (/^\)/.test(l)) { depth = Math.max(0, depth - 1); continue; }
      if (/\($/.test(l) && /^(if|where)/.test(l)) { depth++; continue; } // a block of the "node was not found" check: not walked
      if (depth) continue;
      let m;
      if ((m = /^if "%QUICK%"=="1" goto (\w+)$/.exec(l))) { if (quick) i = labels[m[1]]; continue; }
      if ((m = /^if not "%QUICK%"=="1" goto (\w+)$/.exec(l))) { if (!quick) i = labels[m[1]]; continue; }
      if ((m = /^if not exist "([^"]+)" goto (\w+)$/.exec(l))) { if (!exists(m[1])) i = labels[m[2]]; continue; }
      if ((m = /^goto (\w+)$/.exec(l))) { if (m[1] === 'failed') { ran.push('failed'); break; } i = labels[m[1]]; continue; }
      if ((m = /^if "%QUICK%"=="1" echo\s+(.*)$/.exec(l))) { if (quick) ran.push('say ' + m[1]); continue; }
      if ((m = /^echo\s+(Quick:.*)$/.exec(l))) { ran.push('say ' + m[1]); continue; }
      if ((m = /^call (npm .*)$/.exec(l))) { ran.push(m[1]); continue; }
      if (/^:failed/.test(l)) { ran.push('failed'); break; }
    }
    return ran;
  };
  const B = ['npm install --save-dev electron electron-builder', 'npm install flag-icons'], cmds = r => r.filter(x => !x.startsWith('say ')), said = r => r.filter(x => x.startsWith('say ')).join(' | ');
  ok('normal build (also with everything here): the blocks, the check and the build, and not a word about being quick', JSON.stringify(cmds(walk(false, true))) === JSON.stringify([...B, 'npm test', 'npm run dist', 'exit']) && JSON.stringify(cmds(walk(false, false))) === JSON.stringify([...B, 'npm test', 'npm run dist', 'exit']) && said(walk(false, true)) === '' && said(walk(false, false)) === '');
  ok('quick build with the blocks here: only the build, and it says what it skipped; without them: the blocks once and the build, never the check', JSON.stringify(cmds(walk(true, true))) === JSON.stringify(['npm run dist', 'exit']) && JSON.stringify(cmds(walk(true, false))) === JSON.stringify([...B, 'npm run dist', 'exit']) && /Quick: they are already here/.test(said(walk(true, true))) && /check is skipped/.test(said(walk(true, true))) && /not all here yet/.test(said(walk(true, false))) && /check is skipped/.test(said(walk(true, false))) && !/Quick: they are already here/.test(said(walk(true, false))));
}
ok('the flag icons (stylesheet and the flag pictures) are in the installer, and build-windows.bat installs them', /node_modules\/flag-icons\/css\//.test(html) && covered('node_modules/flag-icons/css/flag-icons.min.css') && covered('node_modules/flag-icons/flags/4x3/nl.svg') && /npm install flag-icons/.test(bat));
ok('the app icon exists as a square picture of at least 256 pixels', (() => { const b = fs.existsSync(path.join(root, 'build', 'icon.png')) ? fs.readFileSync(path.join(root, 'build', 'icon.png')) : Buffer.alloc(0); return b.length > 24 && b.readUInt32BE(16) >= 256 && b.readUInt32BE(16) === b.readUInt32BE(20); })());
{ // the icon is round: a square picture whose corners are see-through and whose circle is solid (the Windows icon holds the same picture in all its sizes)
  const zlib = require('zlib');
  const decode = b => { // an 8-bit picture with colour and see-through (RGBA), not interlaced: what the icon is made as
    if (b.length < 33 || b.readUInt32BE(0) !== 0x89504e47) return null;
    const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
    if (b[24] !== 8 || b[25] !== 6 || b[28] !== 0) return null;
    let at = 8; const parts = []; while (at + 12 <= b.length) { const n = b.readUInt32BE(at); if (b.toString('latin1', at + 4, at + 8) === 'IDAT') parts.push(b.subarray(at + 8, at + 8 + n)); at += 12 + n; }
    const raw = zlib.inflateSync(Buffer.concat(parts)), stride = w * 4, out = Buffer.alloc(h * stride);
    for (let y = 0; y < h; y++) {
      const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
      for (let x = 0; x < stride; x++) {
        const a = x >= 4 ? out[y * stride + x - 4] : 0, up = y ? out[(y - 1) * stride + x] : 0, c = x >= 4 && y ? out[(y - 1) * stride + x - 4] : 0, p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c);
        out[y * stride + x] = (line[x] + (f === 0 ? 0 : f === 1 ? a : f === 2 ? up : f === 3 ? ((a + up) >> 1) : (pa <= pb && pa <= pc ? a : pb <= pc ? up : c))) & 255;
      }
    }
    return { w, h, alpha: (x, y) => out[y * stride + x * 4 + 3], colour: (x, y) => [...out.subarray(y * stride + x * 4, y * stride + x * 4 + 3)] };
  };
  // round: every point well inside the circle is solid, every point well outside it is see-through (the soft edge, a pixel or two, is left alone)
  const round = pic => {
    if (!pic || pic.w !== pic.h) return false;
    const n = pic.w, c = (n - 1) / 2, margin = Math.max(2, n * 0.02), step = Math.max(1, Math.floor(n / 64)); let inside = 0, outside = 0;
    for (let y = 0; y < n; y += step) for (let x = 0; x < n; x += step) {
      const r = Math.hypot(x - c, y - c);
      if (r < n / 2 - margin) { inside++; if (pic.alpha(x, y) < 250) return false; } else if (r > n / 2 + margin) { outside++; if (pic.alpha(x, y) > 5) return false; }
    }
    return inside > 50 && outside >= 4 && [[0, 0], [n - 1, 0], [0, n - 1], [n - 1, n - 1]].every(([x, y]) => pic.alpha(x, y) <= 5) && pic.alpha(n >> 1, n >> 1) >= 250;
  };
  const icon = decode(fs.readFileSync(path.join(root, 'build', 'icon.png')));
  ok('the app icon is round: a square picture with see-through corners and a solid circle (not a square with the picture in it)', round(icon) && icon.w >= 256);
  ok('...and the picture in the circle is the artwork, not an empty circle (the middle and the edge of the circle have different colours, and it is not all one colour)', (() => { const mid = icon.colour(icon.w >> 1, icon.h >> 1), top = icon.colour(icon.w >> 1, 4), l = icon.colour(4, icon.h >> 1); return mid.join() !== top.join() && top.join() === l.join() && new Set([[mid, top, icon.colour(icon.w >> 2, icon.h >> 2), icon.colour(icon.w >> 1, icon.h * 3 >> 2)].map(x => x.join())].flat()).size > 1; })());
  { // the colours of the current picture: a near black car on a light grey circle, with red lanes in the road
    const mid = icon.colour(icon.w >> 1, icon.h >> 1), top = icon.colour(icon.w >> 1, 6); let red = 0, solid = 0;
    for (let y = 0; y < icon.h; y += 4) for (let x = 0; x < icon.w; x += 4) { if (icon.alpha(x, y) < 250) continue; solid++; const [r, g, b] = icon.colour(x, y); if (r > 110 && g < 70 && b < 80) red++; }
    ok('the icon is the dark car on the light grey circle, with the red lanes of the road (the colours of the picture that was sent)', mid.every(c => c < 70) && top.every(c => c > 225) && red / solid > 0.01 && red / solid < 0.1);
  }
  const ico = fs.readFileSync(path.join(root, 'build', 'icon.ico')), count = ico.readUInt16LE(4), entries = Array.from({ length: count }, (_, i) => { const o = 6 + i * 16; return { size: ico[o] || 256, bytes: ico.readUInt32LE(o + 8), at: ico.readUInt32LE(o + 12) }; });
  ok('the Windows icon holds the picture in the sizes Windows asks for (16, 32, 48, 256 and more)', ico.readUInt16LE(0) === 0 && ico.readUInt16LE(2) === 1 && [16, 32, 48, 256].every(n => entries.some(e => e.size === n)));
  ok('...and it is round in every size that is stored as a picture (see-through corners, a solid circle)', (() => { const pics = entries.map(e => ({ e, pic: decode(ico.subarray(e.at, e.at + e.bytes)) })).filter(x => x.pic); return pics.length >= 4 && pics.some(x => x.e.size === 256) && pics.every(x => x.pic.w === x.e.size && round(x.pic)); })()); }
const os = require('os'), M = require('../migrate'), T = require('../transfer');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-')), oldD = path.join(tmp, 'slot-lap-timer');
ok('nothing to migrate when there is no old data', M.migrate(tmp) === false && !fs.existsSync(path.join(tmp, 'slotforge-timing')));
fs.mkdirSync(oldD); fs.writeFileSync(path.join(oldD, 'slot-lap-timer.json'), '{"tracks":[1]}'); fs.writeFileSync(path.join(oldD, 'slot-lap-timer.before-restore.json'), '{}'); fs.writeFileSync(path.join(oldD, 'other.txt'), 'x');
ok('old data is copied to the new folder and the old folder stays', M.migrate(tmp) === true && fs.readFileSync(path.join(tmp, 'slotforge-timing', 'slotforge-timing.json'), 'utf8') === '{"tracks":[1]}' && fs.existsSync(path.join(tmp, 'slotforge-timing', 'slotforge-timing.before-restore.json')) && !fs.existsSync(path.join(tmp, 'slotforge-timing', 'other.txt')) && fs.existsSync(path.join(oldD, 'slot-lap-timer.json')));
fs.writeFileSync(path.join(tmp, 'slotforge-timing', 'slotforge-timing.json'), '{"tracks":[2]}');
ok('data in the new folder is never overwritten', M.migrate(tmp) === false && fs.readFileSync(path.join(tmp, 'slotforge-timing', 'slotforge-timing.json'), 'utf8') === '{"tracks":[2]}');
ok('the new name is used everywhere and the old exports still import', pkg.build.productName === 'SlotForge Timing' && /slotforge-timing'\)\)/.test(mainText) && /require\('\.\/migrate'\)/.test(mainText) && T.FORMAT === 'slotforge-timing-export');
{ // the live data: main.js puts the messages of the race window together, so that a window or phone that opens late is given the whole state
  const pre = fs.readFileSync(path.join(root, 'preload.js'), 'utf8'), raceText = fs.readFileSync(path.join(root, 'renderer', 'race.js'), 'utf8'), viewText = fs.readFileSync(path.join(root, 'renderer', 'liveview.js'), 'utf8');
  ok('main.js keeps the whole state by putting each message of the race window on the one before, and passes the message on as it came (to every window including its sender, and to phones)', /require\('\.\/renderer\/liveshare\.js'\)/.test(mainText) && /LiveShare\.applyDynamic\(live\.dyn, d\)/.test(mainText) && /relay\('live:push', d, null\)/.test(mainText) && /net\.server\.broadcast\('push', d\)/.test(mainText));
  ok('...when a message does not fit, the race window is asked to send everything again (live:resync reaches it through the preload script)', /e\.sender\.send\('live:resync'\)/.test(mainText) && /ipcRenderer\.on\('live:resync'/.test(pre) && /onLiveResync/.test(pre) && /api\.onLiveResync\(/.test(raceText) && /live\.sender\.reset\(\)/.test(raceText));
  ok('...and the resync request makes the race window start again from everything (reset, then send)', /onLiveResync\(\(\) => \{[^}]*live\.sender\.reset\(\)/.test(raceText));
  { // the handler of main.js itself, run against stand-ins: the whole state is put together, passed on as it came, and a message that does not fit is answered with a request
    const m = mainText.match(/ipcMain\.on\('live:push', safe\('live:push', \(e, d\) => \{[\s\S]*?\n  \}\)\);/), LS = require(path.join(root, 'renderer', 'liveshare.js')), RE = require(path.join(root, 'renderer', 'engine.js'));
    const live = { stat: null, dyn: null }, relayed = [], broadcast = [], handlers = {}, asked = [], net = { server: { broadcast: (a, b) => broadcast.push([a, b]) } };
    if (m) new Function('ipcMain', 'live', 'LiveShare', 'relay', 'net', 'safe', m[0])({ on: (n, f) => { handlers[n] = f; } }, live, LS, (...a) => relayed.push(a), net, (name, f) => f); // (safe: main.js wraps the handlers so that an exception is logged and not shown as a dialog)
    const entries = [0, 1].map(i => ({ lane: i, driverId: 'd' + i, carId: 'c' + i, driverName: 'D' + i, carName: 'C' + i })), r = RE.createRace({ type: 'practice', entries, minLap: 800 }); r.start(0);
    const S = LS.sender(), cx = t => ({ raceId: 'x', eng: r, phase: 'running', calling: false, lights: 5, heat: null, flash: new Map(), bestAll: Infinity, bestAllName: '', bestBy: new Map(), now: t, champ: null });
    const e = { sender: { send: c => asked.push(c) } }, push = t => { const msg = S.pack(cx(t), t); if (msg) handlers['live:push'](e, JSON.parse(JSON.stringify(msg))); return msg; };
    r.cross(0, 6000); r.cross(1, 6100); push(6200); r.cross(0, 12000); push(12100); r.cross(0, 18000); r.cross(1, 18200); push(18300);
    ok('main.js (its own handler, run here) keeps the whole state: the laps of all the messages, as a whole list', !!m && !!live.dyn && live.dyn.cars[0].laps.length === 3 && live.dyn.cars[1].laps.length === 2 && live.dyn.seq === 3 && asked.length === 0);
    ok('...and passes every message on as it came (windows and phones put them together themselves)', relayed.length === 3 && relayed.every(x => x[0] === 'live:push' && x[2] === null) && relayed[1][1].cars[0].laps.from === 1 && broadcast.length === 3 && broadcast[2][0] === 'push' && broadcast[2][1].seq === 3);
    r.cross(0, 24000); S.pack(cx(24100), 24100); // this one never arrives
    r.cross(1, 25000); push(25100);
    ok('...a message that does not fit (one was lost): the state is dropped rather than made wrong, and the race window is asked to send everything again', live.dyn === null && asked.length === 1 && asked[0] === 'live:resync' && relayed.length === 4);
    S.reset(); push(26000);
    ok('...the everything-message after that makes the state whole again', live.dyn && live.dyn.cars[0].laps.length === 4 && live.dyn.cars[1].laps.length === 3 && asked.length === 1); }
  ok('the race window sends what the sender gives (only what changed), and a new heat starts again from everything', /live\.sender\.pack\(/.test(raceText) && !/api\.livePush\(LiveShare\.packDynamic/.test(raceText) && /if \(live\.sender\) live\.sender\.reset\(\)/.test(raceText));
  ok('a Live Race page (second screen or phone) that misses a message fetches the whole state and carries on', /V\.needsSync\(\)/.test(viewText) && /api\.liveGet\(\)/.test(viewText));
  ok('a window that opens late is given what main.js put together (live:get)', /ipcMain\.handle\('live:get', \(\) => \(\{ stat: live\.stat, dyn: live\.dyn \}\)\)/.test(mainText)); }

{ // 1.35.2: who made the program, and on what terms it may be used
  const lic = fs.existsSync(path.join(root, 'LICENSE')) ? fs.readFileSync(path.join(root, 'LICENSE'), 'utf8') : '', linux = pkg.build.linux || {};
  ok('the package has an author, with his name and his page', pkg.author && pkg.author.name === 'theDutchmanJames' && pkg.author.url === 'https://github.com/theDutchmanJames');
  ok('...a licence (PolyForm Noncommercial, which allows use and changes but no commercial use), and the places of the project (home page, repository, bugs)', pkg.license === 'PolyForm-Noncommercial-1.0.0' && pkg.homepage === 'https://github.com/theDutchmanJames/SlotForgeTiming'
    && pkg.repository && pkg.repository.type === 'git' && pkg.repository.url === 'git+https://github.com/theDutchmanJames/SlotForgeTiming.git' && pkg.bugs && pkg.bugs.url === 'https://github.com/theDutchmanJames/SlotForgeTiming/issues');
  ok('the installers carry no placeholder: the app id is his GitHub name, the maintainer of the Linux package is a real person with an address, and the copyright says whose the program is', pkg.build.appId === 'io.github.thedutchmanjames.slotforgetiming' && /^[a-z0-9.-]+$/.test(pkg.build.appId)
    && linux.maintainer === 'James <thedutchmanjames@gmail.com>' && pkg.build.copyright === 'Copyright © 2026 theDutchmanJames' && !/example\.|\.invalid|noreply/.test(JSON.stringify(pkg)));
  ok('the file LICENSE is the PolyForm Noncommercial License 1.0.0, with the line "Required Notice" that goes with every copy', /^Required Notice: Copyright 2026 theDutchmanJames \(https:\/\/github\.com\/theDutchmanJames\/SlotForgeTiming\)\n/.test(lic)
    && lic.includes('# PolyForm Noncommercial License 1.0.0') && lic.includes('<https://polyformproject.org/licenses/noncommercial/1.0.0>') && lic.includes('Any noncommercial purpose is a permitted purpose.') && lic.includes('## No Liability') && lic.includes('**Use** means anything you do with the software requiring one of your licenses.'));
  ok('...it is in the installer too, and the QR code library keeps the licence it came with', patterns.includes('LICENSE') && fs.existsSync(path.join(root, 'vendor', 'QRCode', 'LICENSE-qrcode-terminal.txt')));
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  ok('the README tells the licence and whose program it is', /## Licence and copyright/.test(readme) && readme.includes('PolyForm Noncommercial License 1.0.0') && readme.includes('SlotForge Timing is made by theDutchmanJames. Copyright 2026 theDutchmanJames.'));
}
console.log(fails ? fails + ' PACKAGE TESTS FAILED' : 'ALL PACKAGE TESTS PASSED'); process.exit(fails ? 1 : 0);
