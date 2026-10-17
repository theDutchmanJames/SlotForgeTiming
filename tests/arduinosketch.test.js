// The embedded sketch (renderer/arduinosketch.js) must match firmware/SlotForgeBox exactly, and the zip the app hands out must be a zip that unzippers open.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const Z = require('../renderer/zipfile.js'), S = require('../renderer/arduinosketch.js');
let fails = 0; const ok = (n, c) => { console.log((c ? 'ok   ' : 'FAIL ') + n); if (!c) fails++; };
const dir = path.join(__dirname, '..', 'firmware', 'SlotForgeBox');
{ // in step with the firmware folder
  const files = fs.readdirSync(dir).filter(f => /\.(ino|h|cpp|md|txt)$/.test(f)).sort();
  ok('every firmware file is embedded', files.every(f => S.files['SlotForgeBox/' + f] !== undefined) && Object.keys(S.files).length === files.length);
  ok('with the same contents (run node tools/pack-sketch.js after a firmware change)', files.every(f => S.files['SlotForgeBox/' + f] === fs.readFileSync(path.join(dir, f), 'utf8')));
  ok('the version comes from settings.h', (/#define SFB_VERSION "([^"]+)"/.exec(S.files['SlotForgeBox/settings.h']) || [])[1] === S.version);
  ok('the .ino is there and includes its headers', /#include "protocol.h"/.test(S.files['SlotForgeBox/SlotForgeBox.ino']));
}
{ // the zip
  ok('crc32 of "123456789" is CBF43926', Z.crc32(Uint8Array.from(Buffer.from('123456789'))).toString(16) === 'cbf43926');
  const bytes = Z.make(Object.keys(S.files).map(name => ({ name, text: S.files[name] })).concat([{ name: 'SlotForgeBox/README.txt', text: 'hello\r\n' }]), new Date(2026, 9, 17, 12, 0, 0));
  ok('the zip starts with the local header signature and ends with the end-of-central-directory record', bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 3 && bytes[3] === 4 && bytes[bytes.length - 22] === 0x50 && bytes[bytes.length - 21] === 0x4b);
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'sfbzip-')), zp = path.join(tmp, 'box.zip'); fs.writeFileSync(zp, bytes);
  let listed = '', extractedOk = false;
  try { listed = execFileSync('python3', ['-I', '-c', `import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); print(z.testzip()); print('\\n'.join(z.namelist())); print(z.read('SlotForgeBox/settings.h').decode()==open(sys.argv[2]).read())`, zp, path.join(dir, 'settings.h')]).toString(); extractedOk = /^None\n/.test(listed) && /True\s*$/.test(listed); } catch (x) { listed = 'python3 failed: ' + x.message; }
  ok('Python opens it, every CRC checks, and a file reads back identical', extractedOk);
  ok('all files are in the zip under SlotForgeBox/', Object.keys(S.files).every(n => listed.includes(n)) && listed.includes('SlotForgeBox/README.txt'));
}
console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0);
