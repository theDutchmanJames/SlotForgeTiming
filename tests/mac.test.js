// The Mac build: the settings in package.json and build-mac.command, which makes the .dmg and the .zip and can install the app for one user.
// The script is run here with stand-ins for npm and for the Mac tools it uses (uname, ditto, xattr, codesign, pgrep, open), so the real build is not started:
// that needs the internet and a Mac. On Windows only the files are checked (there is no bash to run the script).
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const root = path.join(__dirname, '..'), pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
let fails = 0; const ok = (n, c) => { if (c) console.log('ok  ', n); else { console.log('FAIL', n); fails++; } };

// ---- the files ----
const mac = (pkg.build || {}).mac || {}, targets = (mac.target || []).map(t => (typeof t === 'string' ? { target: t } : t));
ok('npm run dist:mac builds for the Mac, and npm run dist and dist:linux still build for Windows and Linux', pkg.scripts['dist:mac'] === 'electron-builder --mac' && pkg.scripts.dist === 'electron-builder --win' && pkg.scripts['dist:linux'] === 'electron-builder --linux');
ok('the Mac build makes a .dmg and a .zip, one app for Apple Silicon and Intel, named SlotForgeTiming-<version>-mac', ['dmg', 'zip'].every(k => targets.some(t => t.target === k && (t.arch || []).length === 1 && t.arch[0] === 'universal')) && mac.artifactName === 'SlotForgeTiming-${version}-mac.${ext}');
ok('the Mac build has an app category and uses the round icon', mac.category === 'public.app-category.utilities' && mac.icon === 'build/icon.png');
ok('the icon is a square picture of at least 512 pixels (a Mac app icon needs that)', (() => { const b = fs.readFileSync(path.join(root, 'build', 'icon.png')); return b.readUInt32BE(16) >= 512 && b.readUInt32BE(16) === b.readUInt32BE(20); })());
ok('1.21.0: ...and it is 1024 x 1024 pixels with a see-through background (colour type 6, 8 bits), so the Mac icon is sharp on a Retina screen', (() => { const b = fs.readFileSync(path.join(root, 'build', 'icon.png')); return b.readUInt32BE(16) === 1024 && b.readUInt32BE(20) === 1024 && b[24] === 8 && b[25] === 6; })());
ok('...it is drawn, not enlarged: build/icon.svg is the vector drawing of it (1024 units wide, a circle, no picture inside), and build/README.txt says so', (() => { const svg = fs.readFileSync(path.join(root, 'build', 'icon.svg'), 'utf8'), txt = fs.readFileSync(path.join(root, 'build', 'README.txt'), 'utf8'); return /<svg[^>]*viewBox="0 0 1024 1024"/.test(svg) && /<circle cx="512" cy="512" r="512"/.test(svg) && !/<image|base64|data:image/.test(svg) && svg.length < 150000 && /icon\.svg/.test(txt) && /1024 x 1024/.test(txt); })());
ok('the Mac build uses the same list of files as the Windows build (the one test/package.test.js checks)', Array.isArray(pkg.build.files) && !mac.files);
ok('the description names the Mac', /macOS/.test(pkg.description || ''));
ok('npm test runs this test', /node tests\/mac\.test\.js/.test(pkg.scripts.test));
const file = path.join(root, 'build-mac.command'), sh = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
ok('build-mac.command exists, starts with a bash line, has Unix line endings and runs the same steps as build-linux.sh', sh.startsWith('#!/usr/bin/env bash\n') && !/\r/.test(sh) && /npm install --save-dev electron electron-builder/.test(sh) && /npm install flag-icons/.test(sh) && /\bnpm test\b/.test(sh) && /npm run dist:mac/.test(sh));
ok('build-mac.command can be run (it has the execute permission), and it ends in .command so a double-click in Finder opens it in Terminal', process.platform === 'win32' || (fs.statSync(file).mode & 0o100) !== 0);
const code = sh.replace(/^\s*#.*$/gm, '');
ok('the installer never needs a password: no sudo is run by the script', !/^\s*sudo\b/m.test(code) && !/\bsudo\s+(cp|mv|rm|chmod|installer|ditto)\b/.test(code.replace(/say "[^"]*"/g, '')));
ok('the script only uses what the bash of macOS (version 3.2) has: no associative arrays, mapfile, case changes of ${x,,}, |& or &>>', !/declare\s+-A|\bmapfile\b|\breadarray\b|\$\{[A-Za-z_]+(,,|\^\^|,|\^)\}|\|&|&>>|\bcoproc\b|;&|;;&/.test(code));
ok('the script does not use things a Mac does not have (readlink -f, getent, xdg-open, ldconfig, sed -r)', !/readlink\s+-f|\bgetent\b|\bxdg-|\bldconfig\b|sed\s+-r\b|\bstat\s+-c\b|\bdate\s+-d\b/.test(code));

const quickFile = path.join(root, 'build-mac-quick.command'), quickSh = fs.existsSync(quickFile) ? fs.readFileSync(quickFile, 'utf8') : '';
ok('build-mac-quick.command exists, ends in .command (a double-click in Finder opens it), has Unix line endings, can be run, and only starts build-mac.command with --quick', quickSh.startsWith('#!/usr/bin/env bash\n') && !/\r/.test(quickSh) && (process.platform === 'win32' || (fs.statSync(quickFile).mode & 0o100) !== 0) && quickSh.replace(/^\s*#.*$/gm, '').trim().split('\n').length === 1 && /build-mac\.command" --quick "\$@"/.test(quickSh));
ok('the quick build skips two steps and nothing else: the check of the app (npm test) and the building blocks that are already there', /--quick\) QUICK=1/.test(sh) && /\[ "\$QUICK" = 1 \] && blocks_here/.test(sh) && /node_modules\/electron\/package\.json/.test(sh) && /node_modules\/electron-builder\/package\.json/.test(sh) && /node_modules\/flag-icons\/package\.json/.test(sh));
ok('the quick wrapper also only uses what the bash of macOS (version 3.2) has', !/declare\s+-A|\bmapfile\b|\$\{[A-Za-z_]+(,,|\^\^)\}|\|&|&>>/.test(quickSh));

const hasBash = process.platform !== 'win32' && cp.spawnSync('bash', ['--version']).status === 0;
if (!hasBash) console.log('skip the checks that run build-mac.command (they need bash on Linux or macOS)');
else {
  ok('build-mac.command has no syntax errors', cp.spawnSync('bash', ['-n', file]).status === 0);
  const help = cp.spawnSync('bash', [file, '--help'], { encoding: 'utf8' });
  ok('--help explains the options', help.status === 0 && /--install/.test(help.stdout) && /--no-install/.test(help.stdout) && /--uninstall/.test(help.stdout) && /--no-pause/.test(help.stdout) && /--quick/.test(help.stdout) && /\.dmg/.test(help.stdout) && /Applications/.test(help.stdout));

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mac-'));
  const w = (p, text, mode) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); if (mode) fs.chmodSync(p, mode); return p; };
  const APP = 'SlotForge Timing.app';
  // a project folder with the script, a version and an icon; stand-ins for npm and for the Mac tools, which write down what they were asked
  const mk = name => {
    const dir = path.join(tmp, name), proj = path.join(dir, 'project'), bin = path.join(dir, 'bin'), home = path.join(dir, 'home'), apps = path.join(dir, 'Applications');
    w(path.join(proj, 'build-mac.command'), sh, 0o755); w(path.join(proj, 'package.json'), '{"name":"x","version":"9.9.9"}'); w(path.join(proj, 'build', 'icon.png'), 'PNG');
    fs.mkdirSync(home, { recursive: true }); fs.mkdirSync(apps, { recursive: true });
    w(path.join(bin, 'npm'), `#!/bin/sh
echo "$*" >> "${dir}/npm.log"
case "$*" in
  "test") [ -n "$FAKE_TEST_FAIL" ] && exit 1 ;;
  "run dist:mac")
    make_app() { d="dist/\${FAKE_APPDIR:-mac-universal}/${APP}"; mkdir -p "$d/Contents/MacOS"; printf '#!/bin/sh\\necho running\\n' > "$d/Contents/MacOS/SlotForge Timing"; chmod +x "$d/Contents/MacOS/SlotForge Timing"; printf 'new' > "$d/Contents/Info.plist"; }
    [ -n "$FAKE_BUILD_FAIL" ] && [ -z "$FAKE_BUILD_KEEP_APP" ] && exit 1
    make_app
    [ -n "$FAKE_BUILD_FAIL" ] && exit 1
    printf 'dmg' > dist/SlotForgeTiming-9.9.9-mac.dmg; printf 'zip' > dist/SlotForgeTiming-9.9.9-mac.zip ;;
esac
exit 0
`, 0o755);
    w(path.join(bin, 'uname'), '#!/bin/sh\n[ "$1" = "-s" ] && echo "${FAKE_UNAME:-Darwin}" && exit 0\nexec /usr/bin/uname "$@"\n', 0o755);
    w(path.join(bin, 'pgrep'), `#!/bin/sh\necho "$*" >> "${dir}/pgrep.log"\n[ -n "$FAKE_RUNNING" ] && exit 0\nexit 1\n`, 0o755);
    w(path.join(bin, 'ditto'), `#!/bin/sh\necho "ditto $*" >> "${dir}/tools.log"\ncp -R "$1" "$2"\n`, 0o755);
    w(path.join(bin, 'xattr'), `#!/bin/sh\necho "xattr $*" >> "${dir}/tools.log"\nexit 0\n`, 0o755);
    w(path.join(bin, 'codesign'), `#!/bin/sh\necho "codesign $*" >> "${dir}/tools.log"\ncase "$1" in --verify) [ -n "$FAKE_SIGNED" ] && exit 0; exit 1 ;; esac\nexit 0\n`, 0o755);
    w(path.join(bin, 'open'), `#!/bin/sh\necho "open $*" >> "${dir}/tools.log"\nexit 0\n`, 0o755);
    const lines = f => (fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), 'utf8').trim().split('\n') : []);
    return { dir, proj, bin, home, apps, log: () => lines('npm.log'), tools: () => lines('tools.log') };
  };
  const run = (t, args, extra = {}, script = 'build-mac.command') => {
    const env = { PATH: `${t.bin}:${process.env.PATH}`, HOME: t.home, SLOTFORGE_ALLOW_ROOT: '1', SLOTFORGE_APPS: t.apps, LANG: 'C', ...extra };
    return cp.spawnSync('bash', [path.join(t.proj, script), '--no-pause', ...args], { cwd: t.proj, env, encoding: 'utf8', input: '' });
  };
  const read = p => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');
  const inApps = t => path.join(t.apps, APP), inHome = t => path.join(t.home, 'Applications', APP), exe = d => path.join(d, 'Contents', 'MacOS', 'SlotForge Timing');

  { // the whole run, installing
    const t = mk('full'), r = run(t, ['--install']), dest = inApps(t);
    ok('the build runs the steps in order: building blocks, flag icons, the tests, the Mac build', r.status === 0 && JSON.stringify(t.log()) === JSON.stringify(['install --save-dev electron electron-builder', 'install flag-icons', 'test', 'run dist:mac']));
    ok('it says where the .dmg and the .zip are', /dist\/SlotForgeTiming-9\.9\.9-mac\.dmg/.test(r.stdout) && /dist\/SlotForgeTiming-9\.9\.9-mac\.zip/.test(r.stdout) && fs.existsSync(path.join(t.proj, 'dist', 'SlotForgeTiming-9.9.9-mac.dmg')) && fs.existsSync(path.join(t.proj, 'dist', 'SlotForgeTiming-9.9.9-mac.zip')));
    ok('it tells how to open the app on another Mac (the app is not signed with a paid certificate)', /right-click/.test(r.stdout) && /Open Anyway/.test(r.stdout));
    ok('--install copies the app to Applications, with everything in it, and says where', fs.existsSync(exe(dest)) && read(path.join(dest, 'Contents', 'Info.plist')) === 'new' && r.stdout.includes(`Installed: ${dest}`) && (fs.statSync(exe(dest)).mode & 0o100) !== 0);
    const tools = t.tools();
    ok('the app is copied the way Finder does it (ditto), the "downloaded from the internet" mark is taken off, and the dist folder is opened', tools.includes(`ditto ${path.join(t.proj, 'dist', 'mac-universal', APP)} ${dest}`) && tools.includes(`xattr -dr com.apple.quarantine ${dest}`) && tools.includes(`open ${path.join(t.proj, 'dist')}`));
    ok('an app without a good signature gets one for this Mac (needed on an Apple chip), after it is checked', tools.indexOf(`codesign --verify --deep ${dest}`) >= 0 && tools.includes(`codesign --force --deep --sign - ${dest}`) && tools.indexOf(`codesign --verify --deep ${dest}`) < tools.indexOf(`codesign --force --deep --sign - ${dest}`));
    ok('it points to the Dock and Spotlight', /Dock/.test(r.stdout) && /Spotlight/.test(r.stdout) && /--uninstall/.test(r.stdout));
    const u = run(t, ['--uninstall']);
    ok('--uninstall removes the app', u.status === 0 && !fs.existsSync(dest) && u.stdout.includes(`Removed: ${dest}`));
    w(path.join(t.home, 'Library', 'Application Support', 'slotforge-timing', 'slotforge-timing.json'), '{}');
    run(t, ['--install']); const u2 = run(t, ['--uninstall']);
    ok('...but never the races and settings, and it says so', fs.existsSync(path.join(t.home, 'Library', 'Application Support', 'slotforge-timing', 'slotforge-timing.json')) && /Library\/Application Support\/slotforge-timing/.test(u2.stdout));
    const u3 = run(t, ['--uninstall']);
    ok('uninstalling when nothing is installed is fine, and says so', u3.status === 0 && /nothing to remove/.test(u3.stdout));
  }
  { // the quick build: no check of the app, and no download of what is already here
    const blocks = (t, which) => (which || ['electron', 'electron-builder', 'flag-icons']).forEach(b => w(path.join(t.proj, 'node_modules', b, 'package.json'), '{}'));
    const BLOCKS = ['install --save-dev electron electron-builder', 'install flag-icons'], dmg = t => path.join(t.proj, 'dist', 'SlotForgeTiming-9.9.9-mac.dmg');
    const t = mk('quick1'), r = run(t, ['--quick', '--no-install']);
    ok('--quick on a first build (nothing downloaded yet) gets the building blocks once, but never runs the check', r.status === 0 && JSON.stringify(t.log()) === JSON.stringify([...BLOCKS, 'run dist:mac']) && /not all here yet/.test(r.stdout) && /the check is skipped/.test(r.stdout) && fs.existsSync(dmg(t)));
    const t2 = mk('quick2'); blocks(t2); const r2 = run(t2, ['--quick', '--no-install']);
    ok('--quick with the building blocks already here runs nothing but the build (no internet needed), and says what it skipped', r2.status === 0 && JSON.stringify(t2.log()) === JSON.stringify(['run dist:mac']) && /already here/.test(r2.stdout) && /the check is skipped/.test(r2.stdout) && fs.existsSync(dmg(t2)));
    const t3 = mk('quick3'); blocks(t3, ['electron', 'electron-builder']); const r3 = run(t3, ['--quick', '--no-install']);
    const t3b = mk('quick3b'); blocks(t3b, ['electron-builder', 'flag-icons']); const r3b = run(t3b, ['--quick', '--no-install']);
    const t3c = mk('quick3c'); blocks(t3c, ['electron', 'flag-icons']); const r3c = run(t3c, ['--quick', '--no-install']);
    ok('one missing building block (Electron, the builder or the flag icons) is enough to get them all again', r3.status === 0 && JSON.stringify(t3.log()) === JSON.stringify([...BLOCKS, 'run dist:mac']) && r3b.status === 0 && t3b.log().length === 3 && r3c.status === 0 && t3c.log().length === 3);
    const t4 = mk('quick4'); blocks(t4); const r4 = run(t4, ['--no-install']);
    ok('without --quick the normal build is as before: the blocks, the check and the build, even when everything is here', r4.status === 0 && JSON.stringify(t4.log()) === JSON.stringify([...BLOCKS, 'test', 'run dist:mac']) && !/Quick/.test(r4.stdout));
    const t5 = mk('quick5'); blocks(t5); const r5 = run(t5, ['--quick', '--install'], { FAKE_TEST_FAIL: '1' });
    ok('a quick build does not run the check, so it is not stopped by one that would fail', r5.status === 0 && !t5.log().includes('test') && fs.existsSync(exe(inApps(t5))));
    const t5b = mk('quick5b'); blocks(t5b); const r5b = run(t5b, ['--quick', '--install'], { FAKE_BUILD_FAIL: '1' });
    ok('...a failing build is reported, as in a normal build, and nothing is installed', r5b.status === 1 && /Something went wrong/.test(r5b.stdout) && !fs.existsSync(inApps(t5b)));
    const t6 = mk('quick6'); blocks(t6); w(path.join(t6.proj, 'build-mac-quick.command'), quickSh, 0o755); const r6 = run(t6, ['--no-install'], {}, 'build-mac-quick.command');
    ok('build-mac-quick.command does the same as build-mac.command --quick', r6.status === 0 && JSON.stringify(t6.log()) === JSON.stringify(['run dist:mac']) && fs.existsSync(dmg(t6)));
    const t7 = mk('quick7'); blocks(t7); w(path.join(t7.proj, 'build-mac-quick.command'), quickSh, 0o755); const r7 = run(t7, ['--install'], {}, 'build-mac-quick.command');
    ok('...and the other options still work with it (here --install)', r7.status === 0 && fs.existsSync(exe(inApps(t7))));
    const t8 = mk('quick8'); w(path.join(t8.proj, 'build-mac-quick.command'), quickSh, 0o755); const r8 = run(t8, ['--frobnicate'], {}, 'build-mac-quick.command');
    ok('...and an unknown option is still refused before anything is done', r8.status === 1 && /Unknown option/.test(r8.stdout) && t8.log().length === 0);
  }
  { // a signature that is already good is left alone (a paid certificate would be thrown away by signing again)
    const t = mk('signed'), r = run(t, ['--install'], { FAKE_SIGNED: '1' });
    ok('an app that is signed already is not signed again', r.status === 0 && fs.existsSync(exe(inApps(t))) && t.tools().some(x => x.startsWith('codesign --verify')) && !t.tools().some(x => x.includes('--force')));
  }
  { // the folder
    const t = mk('home'), r = run(t, ['--install'], { SLOTFORGE_APPS: path.join(t.dir, 'no-such-folder') });
    ok('where /Applications cannot be written to, the app goes into Applications in the home folder, and the script says so', r.status === 0 && fs.existsSync(exe(inHome(t))) && !fs.existsSync(path.join(t.dir, 'no-such-folder')) && /home folder/.test(r.stdout));
    const u = run(t, ['--uninstall'], { SLOTFORGE_APPS: path.join(t.dir, 'no-such-folder') });
    ok('...and --uninstall finds it there', u.status === 0 && !fs.existsSync(inHome(t)));
    const t2 = mk('both'); fs.mkdirSync(inApps(t2), { recursive: true }); fs.mkdirSync(inHome(t2), { recursive: true });
    const u2 = run(t2, ['--uninstall']);
    ok('--uninstall removes the app from both places', u2.status === 0 && !fs.existsSync(inApps(t2)) && !fs.existsSync(inHome(t2)));
    const t3 = mk('sp'), home = path.join(t3.dir, 'my home'); fs.mkdirSync(home, { recursive: true });
    const r3 = run(t3, ['--install'], { HOME: home, SLOTFORGE_APPS: path.join(t3.dir, 'no-such-folder') });
    ok('a home folder with a space in its name works', r3.status === 0 && fs.existsSync(exe(path.join(home, 'Applications', APP))));
    const t5 = mk('afile'), notAFolder = w(path.join(t5.dir, 'Applications-file'), 'x'), r5 = run(t5, ['--install'], { SLOTFORGE_APPS: notAFolder });
    ok('something that is not a folder is never used as the Applications folder', r5.status === 0 && fs.existsSync(exe(inHome(t5))) && read(notAFolder) === 'x');
    const t4 = mk('old'); w(path.join(inApps(t4), 'Contents', 'old-file'), 'old'); w(path.join(inApps(t4), 'Contents', 'Info.plist'), 'old');
    const r4 = run(t4, ['--install']);
    ok('an older copy is replaced, and nothing of it is left behind', r4.status === 0 && read(path.join(inApps(t4), 'Contents', 'Info.plist')) === 'new' && !fs.existsSync(path.join(inApps(t4), 'Contents', 'old-file')));
  }
  { // the app is open
    const t = mk('open'), r = run(t, ['--install'], { FAKE_RUNNING: '1' });
    ok('while the app is open nothing is replaced: the script says to quit it first, and the files are still made', r.status === 0 && /Quit it/.test(r.stdout) && /was not installed/.test(r.stdout) && !fs.existsSync(inApps(t)) && fs.existsSync(path.join(t.proj, 'dist', 'SlotForgeTiming-9.9.9-mac.dmg')));
    fs.mkdirSync(inApps(t), { recursive: true });
    const u = run(t, ['--uninstall'], { FAKE_RUNNING: '1' });
    ok('...and an open app is not removed either', u.status === 0 && fs.existsSync(inApps(t)) && /Quit it/.test(u.stdout));
    ok('it looks for the app by its exact name', t.dir && read(path.join(t.dir, 'pgrep.log')).includes('-x SlotForge Timing'));
  }
  { // which app the build made
    for (const d of ['mac-arm64', 'mac']) {
      const t = mk('dir-' + d), r = run(t, ['--install'], { FAKE_APPDIR: d });
      ok('the app is also found in dist/' + d + ' (a build for one kind of Mac only)', r.status === 0 && fs.existsSync(exe(inApps(t))));
    }
    const t = mk('twoapps'); w(path.join(t.proj, 'dist', 'mac-universal-arm64-temp', APP, 'Contents', 'Info.plist'), 'temp');
    const r = run(t, ['--install']);
    ok('a leftover temporary folder of the universal build is not taken for the app', r.status === 0 && read(path.join(inApps(t), 'Contents', 'Info.plist')) === 'new');
  }
  { // --no-install, and asking
    const t = mk('noinstall'), r = run(t, ['--no-install']);
    ok('--no-install only makes the files', r.status === 0 && fs.existsSync(path.join(t.proj, 'dist', 'SlotForgeTiming-9.9.9-mac.dmg')) && !fs.existsSync(inApps(t)) && /--install/.test(r.stdout) && !t.tools().some(x => x.startsWith('ditto')));
    const t2 = mk('noask'), r2 = run(t2, []);
    ok('without a choice and without a terminal to ask on, nothing is installed', r2.status === 0 && !fs.existsSync(inApps(t2)) && /Not installed/.test(r2.stdout));
  }
  { // when something goes wrong
    const t = mk('testfail'), r = run(t, ['--install'], { FAKE_TEST_FAIL: '1' });
    ok('a failing check stops the build before the programs are made, and nothing is installed', r.status === 1 && /Something went wrong/.test(r.stdout) && !t.log().includes('run dist:mac') && !fs.existsSync(inApps(t)));
    const t2 = mk('buildfail'), r2 = run(t2, ['--install'], { FAKE_BUILD_FAIL: '1' });
    ok('a failing build is reported, and nothing is installed', r2.status === 1 && /Something went wrong/.test(r2.stdout) && !fs.existsSync(inApps(t2)));
    const t3 = mk('dmgfail'), r3 = run(t3, ['--install'], { FAKE_BUILD_FAIL: '1', FAKE_BUILD_KEEP_APP: '1' });
    ok('when only the .dmg or .zip fails the app is still made and installed, and the script says what happened', r3.status === 0 && /not every file/.test(r3.stdout) && fs.existsSync(exe(inApps(t3))));
    const t4 = mk('stale'); w(path.join(t4.proj, 'dist', 'mac-universal', APP, 'Contents', 'Info.plist'), 'old'); w(path.join(t4.proj, 'dist', 'SlotForgeTiming-9.9.9-mac.dmg'), 'old');
    const r4 = run(t4, ['--install'], { FAKE_BUILD_FAIL: '1' });
    ok('an app or .dmg left by an earlier run is not mistaken for the result of a build that failed', r4.status === 1 && !fs.existsSync(inApps(t4)) && !fs.existsSync(path.join(t4.proj, 'dist', 'SlotForgeTiming-9.9.9-mac.dmg')));
    const t5 = mk('badopt'), r5 = run(t5, ['--frobnicate']);
    ok('an unknown option is refused before anything is done', r5.status === 1 && /Unknown option/.test(r5.stdout) && t5.log().length === 0);
    const t6 = mk('oldnode'); w(path.join(t6.bin, 'node'), `#!/bin/sh\ncase "$*" in *process.versions*) echo 16 ;; *) exec "${process.execPath}" "$@" ;; esac\n`, 0o755);
    const r6 = run(t6, ['--install']);
    ok('a Node.js that is too old is explained, and nothing is started', r6.status === 1 && /too old/.test(r6.stdout) && t6.log().length === 0);
    const t7 = mk('notamac'), r7 = run(t7, ['--install'], { FAKE_UNAME: 'Linux' });
    ok('on a computer that is not a Mac it says so and points to the other builders, and nothing is started', r7.status === 1 && /has to be run on a Mac/.test(r7.stdout) && /build-linux\.sh/.test(r7.stdout) && /build-windows\.bat/.test(r7.stdout) && t7.log().length === 0);
    if (process.getuid && process.getuid() === 0) {
      const t8 = mk('asroot'), r8 = run(t8, ['--install'], { SLOTFORGE_ALLOW_ROOT: '' });
      ok('running as root is refused (the app would be installed for the root account)', r8.status === 1 && /not with sudo/.test(r8.stdout) && t8.log().length === 0);
    }
    const t9 = mk('nonode'), keep = ['bash', 'sed', 'uname', 'cat', 'dirname', 'pwd', 'id', 'printf', 'sh', 'env'].filter(x => cp.spawnSync('sh', ['-c', `command -v ${x}`]).status === 0);
    for (const x of keep) { const p = cp.spawnSync('sh', ['-c', `command -v ${x}`], { encoding: 'utf8' }).stdout.trim(); if (p && !fs.existsSync(path.join(t9.bin, x))) fs.symlinkSync(p, path.join(t9.bin, x)); }
    fs.rmSync(path.join(t9.bin, 'npm')); const r9 = cp.spawnSync('/bin/bash', [path.join(t9.proj, 'build-mac.command'), '--no-pause', '--install'], { cwd: t9.proj, env: { PATH: t9.bin, HOME: t9.home, SLOTFORGE_ALLOW_ROOT: '1', SLOTFORGE_APPS: t9.apps }, encoding: 'utf8', input: '' });
    ok('without Node.js it says where to get it, and nothing is started', r9.status === 1 && /Node\.js was not found/.test(r9.stdout) && /nodejs\.org/.test(r9.stdout) && !fs.existsSync(inApps(t9)));
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(fails ? `\n${fails} MAC TESTS FAILED` : '\nmac: all PASSED');
process.exit(fails ? 1 : 0);
