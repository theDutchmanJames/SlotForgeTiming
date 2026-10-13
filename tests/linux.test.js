// The Linux build: the settings in package.json and build-linux.sh, which makes the AppImage and the .deb and can install the app for one user.
// The script is run here with stand-ins for npm (and, where needed, for Node and the system files it looks at), so the real build is not started:
// that needs the internet and a Linux computer. On Windows only the files are checked (there is no bash to run the script).
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const root = path.join(__dirname, '..'), pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
let fails = 0; const ok = (n, c) => { if (c) console.log('ok  ', n); else { console.log('FAIL', n); fails++; } };

// ---- the files ----
const lin = (pkg.build || {}).linux || {}, targets = (lin.target || []).map(t => (typeof t === 'string' ? t : t.target));
ok('npm run dist:linux builds for Linux, and npm run dist still builds for Windows', pkg.scripts['dist:linux'] === 'electron-builder --linux' && pkg.scripts.dist === 'electron-builder --win');
ok('the Linux build makes an AppImage and a .deb, named SlotForgeTiming-<version>, with a maintainer (a .deb needs one)', targets.includes('AppImage') && targets.includes('deb') && lin.artifactName === 'SlotForgeTiming-${version}.${ext}' && /\S+ <\S+@\S+>/.test(lin.maintainer || ''));
ok('the Linux build uses the same list of files as the Windows build (the one test/package.test.js checks)', Array.isArray(pkg.build.files) && !lin.files);
const sh = fs.existsSync(path.join(root, 'build-linux.sh')) ? fs.readFileSync(path.join(root, 'build-linux.sh'), 'utf8') : '';
ok('build-linux.sh exists, starts with a bash line, has Unix line endings and runs the same steps as build-windows.bat', sh.startsWith('#!/usr/bin/env bash\n') && !/\r/.test(sh) && /npm install --save-dev electron electron-builder/.test(sh) && /npm install flag-icons/.test(sh) && /\bnpm test\b/.test(sh) && /npm run dist:linux/.test(sh));
ok('build-linux.sh can be run (it has the execute permission)', process.platform === 'win32' || (fs.statSync(path.join(root, 'build-linux.sh')).mode & 0o100) !== 0);
ok('the installer never needs a password: no sudo is run by the script', !/^\s*sudo\b/m.test(sh.replace(/^\s*#.*$/gm, '')) && !/\bsudo\s+(cp|mv|rm|chmod|apt|dpkg)\b/.test(sh.replace(/^\s*#.*$/gm, '').replace(/say "[^"]*"/g, '')));

const quickSh = fs.existsSync(path.join(root, 'build-linux-quick.sh')) ? fs.readFileSync(path.join(root, 'build-linux-quick.sh'), 'utf8') : '';
ok('build-linux-quick.sh exists, starts with a bash line, has Unix line endings, can be run, and only starts build-linux.sh with --quick', quickSh.startsWith('#!/usr/bin/env bash\n') && !/\r/.test(quickSh) && (process.platform === 'win32' || (fs.statSync(path.join(root, 'build-linux-quick.sh')).mode & 0o100) !== 0) && quickSh.replace(/^\s*#.*$/gm, '').trim().split('\n').length === 1 && /build-linux\.sh" --quick "\$@"/.test(quickSh));
ok('the quick build skips two steps and nothing else: the check of the app (npm test) and the building blocks that are already there', /--quick\) QUICK=1/.test(sh) && /\[ "\$QUICK" = 1 \] && blocks_here/.test(sh) && /node_modules\/electron\/package\.json/.test(sh) && /node_modules\/electron-builder\/package\.json/.test(sh) && /node_modules\/flag-icons\/package\.json/.test(sh));

const hasBash = process.platform !== 'win32' && cp.spawnSync('bash', ['--version']).status === 0;
if (!hasBash) console.log('skip the checks that run build-linux.sh (they need bash on Linux or macOS)');
else {
  ok('build-linux.sh has no syntax errors', cp.spawnSync('bash', ['-n', path.join(root, 'build-linux.sh')]).status === 0);
  const help = cp.spawnSync('bash', [path.join(root, 'build-linux.sh'), '--help'], { encoding: 'utf8' });
  ok('--help explains the options', help.status === 0 && /--install/.test(help.stdout) && /--no-install/.test(help.stdout) && /--uninstall/.test(help.stdout) && /--no-pause/.test(help.stdout) && /--quick/.test(help.stdout));

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'linux-'));
  const w = (p, text, mode) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); if (mode) fs.chmodSync(p, mode); return p; };
  // a project folder with the script, a version and an icon; a stand-in npm that writes down what it was asked and can be told to fail
  const mk = name => {
    const dir = path.join(tmp, name), proj = path.join(dir, 'project'), bin = path.join(dir, 'bin'), home = path.join(dir, 'home');
    w(path.join(proj, 'build-linux.sh'), sh, 0o755); w(path.join(proj, 'package.json'), '{"name":"x","version":"9.9.9"}'); w(path.join(proj, 'build', 'icon.png'), 'PNG');
    fs.mkdirSync(path.join(home, 'Desktop'), { recursive: true }); fs.mkdirSync(path.join(dir, 'proc'), { recursive: true });
    w(path.join(bin, 'npm'), `#!/bin/sh
echo "$*" >> "${dir}/npm.log"
case "$*" in
  "test") [ -n "$FAKE_TEST_FAIL" ] && exit 1 ;;
  "run dist:linux")
    [ -n "$FAKE_BUILD_FAIL" ] && [ -z "$FAKE_BUILD_KEEP_APPIMAGE" ] && exit 1
    mkdir -p dist; printf '#!/bin/sh\\necho running\\n' > dist/SlotForgeTiming-9.9.9.AppImage
    [ -n "$FAKE_BUILD_FAIL" ] && exit 1
    printf 'deb' > dist/SlotForgeTiming-9.9.9.deb ;;
esac
exit 0
`, 0o755);
    w(path.join(bin, 'ldconfig'), '#!/bin/sh\necho "\tlibfuse.so.2 (libc6,x86-64) => /lib/x86_64-linux-gnu/libfuse.so.2"\n', 0o755);
    w(path.join(bin, 'ldconfig-none'), '#!/bin/sh\necho "\tlibc.so.6 (libc6,x86-64) => /lib/x86_64-linux-gnu/libc.so.6"\n', 0o755);
    return { dir, proj, bin, home, log: () => (fs.existsSync(path.join(dir, 'npm.log')) ? fs.readFileSync(path.join(dir, 'npm.log'), 'utf8').trim().split('\n') : []) };
  };
  const run = (t, args, extra = {}, script = 'build-linux.sh') => {
    const env = { PATH: `${t.bin}:${process.env.PATH}`, HOME: t.home, SLOTFORGE_ALLOW_ROOT: '1', SLOTFORGE_PROC: path.join(t.dir, 'proc'), SLOTFORGE_LDCONFIG: path.join(t.bin, 'ldconfig'), LANG: 'C', ...extra };
    return cp.spawnSync('bash', [path.join(t.proj, script), '--no-pause', ...args], { cwd: t.proj, env, encoding: 'utf8', input: '' });
  };
  const installed = t => path.join(t.home, '.local', 'share', 'slotforge-timing'), entry = t => path.join(t.home, '.local', 'share', 'applications', 'slotforge-timing.desktop');
  const read = p => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');

  { // the whole run, installing
    const t = mk('full'), r = run(t, ['--install']), e = read(entry(t)), app = path.join(installed(t), 'SlotForgeTiming-9.9.9.AppImage');
    ok('the build runs the steps in order: building blocks, flag icons, the tests, the Linux build', r.status === 0 && JSON.stringify(t.log()) === JSON.stringify(['install --save-dev electron electron-builder', 'install flag-icons', 'test', 'run dist:linux']));
    ok('it says where the files are and how to install the .deb', /dist\/SlotForgeTiming-9\.9\.9\.AppImage/.test(r.stdout) && /sudo apt install/.test(r.stdout) && fs.existsSync(path.join(t.proj, 'dist', 'SlotForgeTiming-9.9.9.deb')));
    ok('--install copies the AppImage to the user\'s own folder and makes it runnable', fs.existsSync(app) && (fs.statSync(app).mode & 0o100) !== 0 && fs.existsSync(path.join(installed(t), 'icon.png')));
    ok('the menu entry starts that AppImage, shows the icon and names the app (nothing extra on a normal system)', e.includes('[Desktop Entry]') && e.includes('Name=SlotForge Timing') && e.includes(`Exec="${app}"\n`) && e.includes(`Icon=${path.join(installed(t), 'icon.png')}`) && e.includes('Terminal=false') && e.includes('Categories=Utility;') && !e.includes('--no-sandbox') && !e.includes('APPIMAGE_EXTRACT_AND_RUN'));
    const d = path.join(t.home, 'Desktop', 'slotforge-timing.desktop');
    ok('a shortcut is put on the desktop, and it can be run', read(d) === e && (fs.statSync(d).mode & 0o100) !== 0);
    const v = cp.spawnSync('desktop-file-validate', [entry(t)], { encoding: 'utf8' });
    ok('the menu entry is valid (desktop-file-validate)' + (v.error ? ' - skipped, the tool is not installed' : ''), v.error ? true : v.status === 0);
    const u = run(t, ['--uninstall']);
    ok('--uninstall removes the program, the menu entry and the shortcut', u.status === 0 && !fs.existsSync(installed(t)) && !fs.existsSync(entry(t)) && !fs.existsSync(d));
    fs.mkdirSync(path.join(t.home, '.config', 'slotforge-timing'), { recursive: true }); fs.writeFileSync(path.join(t.home, '.config', 'slotforge-timing', 'slotforge-timing.json'), '{}');
    run(t, ['--install']); const u2 = run(t, ['--uninstall']);
    ok('...but never the races and settings, and it says so', fs.existsSync(path.join(t.home, '.config', 'slotforge-timing', 'slotforge-timing.json')) && /\.config\/slotforge-timing/.test(u2.stdout));
    ok('uninstalling when nothing is installed is fine', run(t, ['--uninstall']).status === 0);
  }
  { // a system that does not allow the app's own sandbox, and has no libfuse2
    const t = mk('strict'); w(path.join(t.dir, 'proc', 'sys', 'kernel', 'apparmor_restrict_unprivileged_userns'), '1\n');
    const r = run(t, ['--install'], { SLOTFORGE_LDCONFIG: path.join(t.bin, 'ldconfig-none') }), e = read(entry(t)), app = path.join(installed(t), 'SlotForgeTiming-9.9.9.AppImage');
    ok('where the sandbox is not allowed the entry starts the app with --no-sandbox, and says so', r.status === 0 && e.includes(`--no-sandbox`) && /--no-sandbox/.test(r.stdout));
    ok('where libfuse2 is missing the entry starts the AppImage by unpacking it, and says so', e.includes(`Exec=env APPIMAGE_EXTRACT_AND_RUN=1 "${app}" --no-sandbox\n`) && /libfuse2/.test(r.stdout));
    const t2 = mk('userns0'); w(path.join(t2.dir, 'proc', 'sys', 'user', 'max_user_namespaces'), '0\n'); run(t2, ['--install']);
    const t3 = mk('userns1'); w(path.join(t3.dir, 'proc', 'sys', 'kernel', 'unprivileged_userns_clone'), '0\n'); run(t3, ['--install']);
    const t4 = mk('open'); w(path.join(t4.dir, 'proc', 'sys', 'kernel', 'apparmor_restrict_unprivileged_userns'), '0\n'); w(path.join(t4.dir, 'proc', 'sys', 'kernel', 'unprivileged_userns_clone'), '1\n'); w(path.join(t4.dir, 'proc', 'sys', 'user', 'max_user_namespaces'), '31000\n'); run(t4, ['--install']);
    ok('every way a system can forbid user namespaces is noticed, and a system that allows them gets no flag', read(entry(t2)).includes('--no-sandbox') && read(entry(t3)).includes('--no-sandbox') && !read(entry(t4)).includes('--no-sandbox'));
  }
  { // the quick build: no check of the app, and no download of what is already here
    const blocks = (t, which) => (which || ['electron', 'electron-builder', 'flag-icons']).forEach(b => w(path.join(t.proj, 'node_modules', b, 'package.json'), '{}'));
    const BLOCKS = ['install --save-dev electron electron-builder', 'install flag-icons'], dist = t => path.join(t.proj, 'dist', 'SlotForgeTiming-9.9.9.AppImage');
    const t = mk('quick1'), r = run(t, ['--quick', '--no-install']);
    ok('--quick on a first build (nothing downloaded yet) gets the building blocks once, but never runs the check', r.status === 0 && JSON.stringify(t.log()) === JSON.stringify([...BLOCKS, 'run dist:linux']) && /not all here yet/.test(r.stdout) && /the check is skipped/.test(r.stdout) && fs.existsSync(dist(t)));
    const t2 = mk('quick2'); blocks(t2); const r2 = run(t2, ['--quick', '--no-install']);
    ok('--quick with the building blocks already here runs nothing but the build (no internet needed), and says what it skipped', r2.status === 0 && JSON.stringify(t2.log()) === JSON.stringify(['run dist:linux']) && /already here/.test(r2.stdout) && /the check is skipped/.test(r2.stdout) && fs.existsSync(dist(t2)));
    const t3 = mk('quick3'); blocks(t3, ['electron', 'electron-builder']); const r3 = run(t3, ['--quick', '--no-install']);
    ok('one missing building block (the flag icons) is enough to get them all again', r3.status === 0 && JSON.stringify(t3.log()) === JSON.stringify([...BLOCKS, 'run dist:linux']));
    const t3b = mk('quick3b'); blocks(t3b, ['electron-builder', 'flag-icons']); const r3b = run(t3b, ['--quick', '--no-install']);
    const t3c = mk('quick3c'); blocks(t3c, ['electron', 'flag-icons']); const r3c = run(t3c, ['--quick', '--no-install']);
    ok('...whichever one it is (Electron, the builder or the flag icons)', r3b.status === 0 && t3b.log().length === 3 && r3c.status === 0 && t3c.log().length === 3);
    const t4 = mk('quick4'); blocks(t4); const r4 = run(t4, ['--no-install']);
    ok('without --quick the normal build is as before: the blocks, the check and the build, even when everything is here', r4.status === 0 && JSON.stringify(t4.log()) === JSON.stringify([...BLOCKS, 'test', 'run dist:linux']) && !/Quick/.test(r4.stdout));
    const t5 = mk('quick5'); blocks(t5); const r5 = run(t5, ['--quick', '--install'], { FAKE_TEST_FAIL: '1' });
    ok('a quick build does not run the check, so it is not stopped by one that would fail; the build itself still can fail', r5.status === 0 && !t5.log().includes('test') && fs.existsSync(path.join(installed(t5), 'SlotForgeTiming-9.9.9.AppImage')));
    const t5b = mk('quick5b'); blocks(t5b); const r5b = run(t5b, ['--quick', '--install'], { FAKE_BUILD_FAIL: '1' });
    ok('...a failing build is reported, as in a normal build, and nothing is installed', r5b.status === 1 && /Something went wrong/.test(r5b.stdout) && !fs.existsSync(installed(t5b)));
    const t6 = mk('quick6'); blocks(t6); w(path.join(t6.proj, 'build-linux-quick.sh'), quickSh, 0o755); const r6 = run(t6, ['--no-install'], {}, 'build-linux-quick.sh');
    ok('build-linux-quick.sh does the same as build-linux.sh --quick', r6.status === 0 && JSON.stringify(t6.log()) === JSON.stringify(['run dist:linux']) && fs.existsSync(dist(t6)));
    const t7 = mk('quick7'); blocks(t7); w(path.join(t7.proj, 'build-linux-quick.sh'), quickSh, 0o755); const r7 = run(t7, ['--install'], {}, 'build-linux-quick.sh');
    ok('...and the other options still work with it (here --install)', r7.status === 0 && fs.existsSync(path.join(installed(t7), 'SlotForgeTiming-9.9.9.AppImage')));
    const t8 = mk('quick8'); w(path.join(t8.proj, 'build-linux-quick.sh'), quickSh, 0o755); const r8 = run(t8, ['--frobnicate'], {}, 'build-linux-quick.sh');
    ok('...and an unknown option is still refused before anything is done', r8.status === 1 && /Unknown option/.test(r8.stdout) && t8.log().length === 0);
  }
  { // --no-install, and asking
    const t = mk('noinstall'), r = run(t, ['--no-install']);
    ok('--no-install only makes the files', r.status === 0 && fs.existsSync(path.join(t.proj, 'dist', 'SlotForgeTiming-9.9.9.AppImage')) && !fs.existsSync(installed(t)) && !fs.existsSync(entry(t)) && /--install/.test(r.stdout));
    const t2 = mk('noask'), r2 = run(t2, []);
    ok('without a choice and without a terminal to ask on, nothing is installed', r2.status === 0 && !fs.existsSync(installed(t2)) && /Not installed/.test(r2.stdout));
  }
  { // when something goes wrong
    const t = mk('testfail'), r = run(t, ['--install'], { FAKE_TEST_FAIL: '1' });
    ok('a failing check stops the build before the programs are made, and nothing is installed', r.status === 1 && /Something went wrong/.test(r.stdout) && !t.log().includes('run dist:linux') && !fs.existsSync(installed(t)));
    const t2 = mk('buildfail'), r2 = run(t2, ['--install'], { FAKE_BUILD_FAIL: '1' });
    ok('a failing build is reported, and nothing is installed', r2.status === 1 && /Something went wrong/.test(r2.stdout) && !fs.existsSync(installed(t2)));
    const t3 = mk('debfail'), r3 = run(t3, ['--install'], { FAKE_BUILD_FAIL: '1', FAKE_BUILD_KEEP_APPIMAGE: '1' });
    ok('when only the .deb fails the AppImage is still made and installed, and the script says what happened', r3.status === 0 && /\.deb was not/.test(r3.stdout) && fs.existsSync(path.join(installed(t3), 'SlotForgeTiming-9.9.9.AppImage')));
    const t4 = mk('stale'); w(path.join(t4.proj, 'dist', 'SlotForgeTiming-9.9.9.AppImage'), 'old'); const r4 = run(t4, ['--install'], { FAKE_BUILD_FAIL: '1' });
    ok('an AppImage left by an earlier run is not mistaken for the result of a build that failed', r4.status === 1 && !fs.existsSync(installed(t4)));
    const t5 = mk('badopt'), r5 = run(t5, ['--frobnicate']);
    ok('an unknown option is refused before anything is done', r5.status === 1 && /Unknown option/.test(r5.stdout) && t5.log().length === 0);
    const t6 = mk('oldnode'); w(path.join(t6.bin, 'node'), `#!/bin/sh\ncase "$*" in *process.versions*) echo 16 ;; *) exec "${process.execPath}" "$@" ;; esac\n`, 0o755);
    const r6 = run(t6, ['--install']);
    ok('a Node.js that is too old is explained, and nothing is started', r6.status === 1 && /too old/.test(r6.stdout) && t6.log().length === 0);
    const t7 = mk('weird'); const weird = path.join(t7.dir, 'ho"me'); fs.mkdirSync(path.join(weird, 'Desktop'), { recursive: true });
    const r7 = run(t7, ['--install'], { HOME: weird });
    ok('a home folder with a character a menu entry cannot hold: the files are made, the app is not installed, and it says how to run it', r7.status === 0 && /not installed/.test(r7.stdout) && fs.existsSync(path.join(t7.proj, 'dist', 'SlotForgeTiming-9.9.9.AppImage')) && !fs.existsSync(path.join(weird, '.local')));
    if (process.getuid && process.getuid() === 0) {
      const t8 = mk('asroot'), r8 = run(t8, ['--install'], { SLOTFORGE_ALLOW_ROOT: '' });
      ok('running as root is refused (the app would be installed into the root account)', r8.status === 1 && /not with sudo/.test(r8.stdout) && t8.log().length === 0);
    }
  }
  { // a home folder with a space in it
    const t = mk('space'), home = path.join(t.dir, 'my home'); fs.mkdirSync(path.join(home, 'Desktop'), { recursive: true });
    const r = run(t, ['--install'], { HOME: home }), e = read(path.join(home, '.local', 'share', 'applications', 'slotforge-timing.desktop'));
    ok('a home folder with a space in its name works: the path in the menu entry is quoted', r.status === 0 && e.includes(`Exec="${path.join(home, '.local', 'share', 'slotforge-timing', 'SlotForgeTiming-9.9.9.AppImage')}"`));
  }
  { // XDG_DATA_HOME
    const t = mk('xdg'), data = path.join(t.dir, 'data'); run(t, ['--install'], { XDG_DATA_HOME: data });
    ok('XDG_DATA_HOME is respected', fs.existsSync(path.join(data, 'applications', 'slotforge-timing.desktop')) && fs.existsSync(path.join(data, 'slotforge-timing', 'SlotForgeTiming-9.9.9.AppImage')) && !fs.existsSync(path.join(t.home, '.local')));
  }
  { // the serial port hint
    const t = mk('serial'), groupBin = path.join(t.dir, 'bin2'); w(path.join(groupBin, 'getent'), '#!/bin/sh\n[ "$1" = group ] && [ "$2" = dialout ] && echo "dialout:x:20:" && exit 0\nexit 2\n', 0o755);
    w(path.join(groupBin, 'id'), '#!/bin/sh\n[ "$1" = "-nG" ] && echo "users audio" && exit 0\n[ "$1" = "-u" ] && echo 1000 && exit 0\nexit 1\n', 0o755);
    const r = run(t, ['--no-install'], { PATH: `${groupBin}:${t.bin}:${process.env.PATH}` });
    ok('a user who is not in the serial port group is told how to join it (the Trackmate is a serial device)', r.status === 0 && /sudo usermod -aG dialout \$USER/.test(r.stdout));
    w(path.join(groupBin, 'id'), '#!/bin/sh\n[ "$1" = "-nG" ] && echo "users dialout" && exit 0\n[ "$1" = "-u" ] && echo 1000 && exit 0\nexit 1\n', 0o755);
    const r2 = run(t, ['--no-install'], { PATH: `${groupBin}:${t.bin}:${process.env.PATH}` });
    ok('...and one who already is, is not', r2.status === 0 && !/usermod/.test(r2.stdout));
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(fails ? `\n${fails} LINUX TESTS FAILED` : '\nlinux: all PASSED');
process.exit(fails ? 1 : 0);
