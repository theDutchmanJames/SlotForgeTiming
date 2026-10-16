// The voice report (1.16.1): what this computer offers for text to speech, for when a voice is missing in the app (Audio Settings > Voice report).
// Windows only. It reads the voice lists of Windows: the two places in the registry (Speech_OneCore, which the app is given first, and the classic SAPI 5 list) and the voices of the
// Windows Runtime, which PowerShell can list. It only reads: nothing is changed, and nothing is sent anywhere. The report is text; the person decides whether to send it to somebody.
const { execFile } = require('child_process');
const os = require('os');

const KEYS = [
  ['Windows registry, Speech_OneCore voices (the list the app is given first)', 'HKLM\\SOFTWARE\\Microsoft\\Speech_OneCore\\Voices\\Tokens'],
  ['Windows registry, classic SAPI 5 voices (Speech)', 'HKLM\\SOFTWARE\\Microsoft\\Speech\\Voices\\Tokens']];
// (static text: nothing from outside goes into these commands)
const PS = "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [void][Windows.Media.SpeechSynthesis.SpeechSynthesizer,Windows.Media.SpeechSynthesis,ContentType=WindowsRuntime]; "
  + "[Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | ForEach-Object { $_.DisplayName + ' | ' + $_.Language + ' | ' + $_.Id }";

// the names of the sub keys that "reg query KEY" lists (its lines are full paths: KEY\name)
function tokensOf(text, key) {
  const norm = x => String(x).replace(/^HKLM\\/i, 'HKEY_LOCAL_MACHINE\\').toLowerCase(), k = norm(key) + '\\'; // (reg.exe writes HKEY_LOCAL_MACHINE, whatever the way it was asked)
  return [...new Set(String(text || '').split(/\r?\n/).map(l => l.trim()).filter(l => norm(l).startsWith(k)).map(l => l.slice(k.length).split('\\')[0]).filter(Boolean))];
}
const linesOf = text => String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);

// run(exec, file, args) -> { out } or { error }
const run = (exec, file, args) => new Promise(res => {
  try { exec(file, args, { timeout: 20000, windowsHide: true, encoding: 'utf8', maxBuffer: 1 << 20 }, (err, out) => res(err ? { error: err.killed ? 'it took too long' : String((err && err.message) || err).split('\n')[0] } : { out: String(out) })); }
  catch (e) { res({ error: String((e && e.message) || e).split('\n')[0] }); }
});

// { windows, os, parts: [{ title, lines }] }; opts: platform, release, exec (to test)
async function collect(opts = {}) {
  const platform = opts.platform || process.platform, exec = opts.exec || execFile, release = opts.release || os.release();
  if (platform !== 'win32') return { windows: false, os: `${platform} ${release}`, parts: [] };
  const parts = [];
  for (const [title, key] of KEYS) {
    const r = await run(exec, 'reg', ['query', key]);
    const names = r.error ? [] : tokensOf(r.out, key);
    parts.push({ title, lines: r.error ? [`(could not be read: ${r.error})`] : names.length ? names : ['(none)'] });
  }
  const w = await run(exec, 'powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', PS]);
  const vs = w.error ? [] : linesOf(w.out);
  parts.push({ title: 'Windows Runtime voices (name | language | id)', lines: w.error ? [`(could not be read: ${w.error})`] : vs.length ? vs : ['(none)'] });
  return { windows: true, os: `win32 ${release}`, parts };
}

module.exports = { collect, tokensOf, KEYS, PS };
