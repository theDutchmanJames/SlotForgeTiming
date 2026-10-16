// 1.16.1: the voice report (voicereport.js): what Windows offers for text to speech, read from the registry and the Windows Runtime; it only reads. Tested with a stand-in for the commands.
const fs = require('fs'), path = require('path');
const V = require('../voicereport.js'), Sound = require('../renderer/sound.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const [K1, K2] = V.KEYS.map(k => k[1]);
const full = k => k.replace(/^HKLM/, 'HKEY_LOCAL_MACHINE');

// ---- the sub keys of a registry list ----
{ const out = `\r\n${full(K1)}\\MSTTS_V110_enUS_DavidM\r\n${full(K1)}\\MSTTS_V110_enUS_AndrewM\r\n${full(K1)}\\MSTTS_V110_nlNL_FrankM\r\n`;
  ok('the voices of a registry list are the names of its sub keys (reg.exe writes HKEY_LOCAL_MACHINE, also when it was asked with HKLM)', V.tokensOf(out, K1).join() === 'MSTTS_V110_enUS_DavidM,MSTTS_V110_enUS_AndrewM,MSTTS_V110_nlNL_FrankM');
  ok('...the key itself, deeper keys (the attributes of a voice), other lists, empty lines and nothing are not voices', V.tokensOf(`${full(K1)}\r\n${full(K1)}\\Tok1\\Attributes\r\n${full(K2)}\\Other\r\n\r\n   \r\n`, K1).join() === 'Tok1' && V.tokensOf('', K1).length === 0 && V.tokensOf(null, K1).length === 0 && V.tokensOf(undefined, K1).length === 0);
  ok('...a voice is listed once, also when its attributes (a deeper key) are listed too', V.tokensOf(`${full(K1)}\\A\r\n${full(K1)}\\A\\Attributes\r\n${full(K1)}\\B`, K1).join() === 'A,B'); }

// ---- the two lists and the Windows Runtime voices, asked from Windows ----
const stub = (answers) => { const calls = []; const exec = (file, args, o, cb) => { calls.push({ file, args, o }); const r = answers(file, args); r.error ? cb(r.error, '') : cb(null, r.out); }; return { exec, calls }; };
(async () => {
  { const s = stub((file, args) => file === 'reg' ? { out: `${full(args[1])}\\MSTTS_V110_enUS_DavidM\r\n${args[1] === K1 ? full(args[1]) + '\\MSTTS_V110_enUS_AndrewM\r\n' : ''}` } : { out: 'Microsoft David Mobile | en-US | HKEY_X\\David\r\nMicrosoft Andrew (HD) | en-US | HKEY_X\\Andrew\r\n' });
    const r = await V.collect({ platform: 'win32', release: '10.0.26220', exec: s.exec });
    ok('on Windows the report has the two registry lists and the Windows Runtime voices, in that order', r.windows === true && r.os === 'win32 10.0.26220' && r.parts.length === 3 && r.parts[0].title.includes('Speech_OneCore') && r.parts[1].title.includes('classic SAPI 5') && r.parts[2].title.includes('Windows Runtime'));
    ok('...with their voices', r.parts[0].lines.join() === 'MSTTS_V110_enUS_DavidM,MSTTS_V110_enUS_AndrewM' && r.parts[1].lines.join() === 'MSTTS_V110_enUS_DavidM' && r.parts[2].lines.join() === 'Microsoft David Mobile | en-US | HKEY_X\\David,Microsoft Andrew (HD) | en-US | HKEY_X\\Andrew');
    ok('...it asks with "reg query" for both lists and with PowerShell for the voices, and that is all (three commands, each with a time limit and no window)', s.calls.length === 3 && s.calls[0].file === 'reg' && s.calls[0].args.join(' ') === 'query ' + K1 && s.calls[1].args.join(' ') === 'query ' + K2 && s.calls[2].file === 'powershell.exe' && s.calls.every(c => c.o.timeout > 0 && c.o.windowsHide === true && c.o.encoding === 'utf8'));
    const cmd = s.calls[2].args.join(' '), all = s.calls.map(c => c.file + ' ' + c.args.join(' ')).join('\n');
    ok('...it only reads: no command that adds, changes, removes, installs or downloads (reg add/delete/import/copy, Set-, Remove-, New-, Install, Invoke-, Start-)', !/\b(add|delete|import|copy|save|restore|load|unload)\b/i.test(s.calls[0].args.join(' ') + ' ' + s.calls[1].args.join(' ')) && !/\b(Set|Remove|New|Install|Invoke|Start|Add|Out-File|Export|Import)-/i.test(cmd) && !/https?:|curl|wget|WebClient/i.test(all) && cmd.includes('AllVoices') && cmd.includes('NonInteractive'));
    ok('...the PowerShell command is the static text of this file (nothing from outside is put in it)', s.calls[2].args[s.calls[2].args.length - 1] === V.PS && /^\[Console\]::OutputEncoding/.test(V.PS)); }
  { const r = await V.collect({ platform: 'win32', exec: stub((file, args) => file === 'reg' ? { out: '' } : { out: '\r\n' }).exec });
    ok('a list that is empty says (none)', r.parts.every(p => p.lines.join() === '(none)')); }
  { const r = await V.collect({ platform: 'win32', exec: stub((file, args) => file === 'reg' && args[1] === K2 ? { error: { message: 'ERROR: The system was unable to find the specified registry key or value.\nmore', killed: false } } : file === 'powershell.exe' ? { error: { killed: true, message: 'timed out' } } : { out: `${full(K1)}\\A` }).exec });
    ok('a command that fails is told in words, and the others go on (a missing list, a PowerShell that takes too long)', r.parts[0].lines.join() === 'A' && r.parts[1].lines.join() === '(could not be read: ERROR: The system was unable to find the specified registry key or value.)' && r.parts[2].lines.join() === '(could not be read: it took too long)'); }
  { const r = await V.collect({ platform: 'win32', exec: () => { throw new Error('spawn failed'); } });
    ok('a command that cannot even start is told in words too', r.parts.every(p => p.lines[0] === '(could not be read: spawn failed)')); }
  { const s = stub(() => ({ out: '' })), r = await V.collect({ platform: 'linux', release: '6.1.0', exec: s.exec });
    ok('on a computer that is not Windows nothing is asked, and the report says which computer it is', r.windows === false && r.os === 'linux 6.1.0' && r.parts.length === 0 && s.calls.length === 0); }
  { const r = await V.collect();
    ok('the real thing runs here too (this computer is not Windows: no Windows lists)', r.windows === (process.platform === 'win32') && typeof r.os === 'string' && Array.isArray(r.parts) && (r.windows || r.parts.length === 0)); }

  // ---- the text of the report ----
  { const host = { windows: true, os: 'win32 10.0.26220', parts: [{ title: 'Windows registry, Speech_OneCore voices (the list the app is given first)', lines: ['MSTTS_V110_enUS_DavidM'] }, { title: 'Windows Runtime voices (name | language | id)', lines: ['(none)'] }] };
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) slotforge-timing/1.16.1 Chrome/130.0.6723.19 Electron/33.0.0 Safari/537.36';
    const t = Sound.reportText({ ua, voices: [{ name: 'Microsoft David - English (United States)', lang: 'en-US', localService: true }, { name: 'Online one', lang: 'nl-NL', localService: false }], host });
    ok('the report starts with the app and the browser inside it, and says which computer this is', t.split('\n')[0] === 'SlotForge Timing: voice report' && t.split('\n')[1] === 'Electron 33.0.0, Chromium 130.0.6723.19 on win32 10.0.26220');
    ok('...lists the voices the app is offered, with language and whether they are on this computer', t.includes('Voices the app is offered (2):\n  Microsoft David - English (United States) | en-US | on this computer\n  Online one | nl-NL | online'));
    ok('...and every list of Windows under its own title', t.includes('Windows registry, Speech_OneCore voices (the list the app is given first):\n  MSTTS_V110_enUS_DavidM') && t.includes('Windows Runtime voices (name | language | id):\n  (none)'));
    ok('...no voices at all is said (none), and a Windows that could not be asked, or no Windows, is said too', Sound.reportText({ ua: '', voices: [], host: null }).includes('Voices the app is offered (0):\n  (none)') && Sound.reportText({ voices: [] }).includes('could not be asked') && Sound.reportText({ voices: [], host: { windows: false, os: 'linux 6.1' } }).includes('not running Windows') && Sound.reportText().includes('Voices the app is offered (0)')); }

  // ---- the pieces that carry it to the screen ----
  { const root = path.join(__dirname, '..'), read = f => fs.readFileSync(path.join(root, f), 'utf8');
    ok('the preload script has voiceReport and main.js has its handler (the channel test of package.test.js checks the pair)', /voiceReport: \(\) => call\('voices:report'\)/.test(read('preload.js')) && /ipcMain\.handle\('voices:report', \(\) => require\('\.\/voicereport'\)\.collect\(\)\)/.test(read('main.js')));
    ok('the file is in the app (the installer takes every .js file of the main folder) and in the zip list', /"\*\.js"/.test(read('package.json')) && fs.existsSync(path.join(root, 'voicereport.js'))); }

  console.log(fails ? fails + ' VOICE REPORT TESTS FAILED' : 'ALL VOICE REPORT TESTS PASSED'); process.exit(fails ? 1 : 0);
})();
