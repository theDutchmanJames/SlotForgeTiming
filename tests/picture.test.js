// What happens to an uploaded picture (picture.js): kept as it is, or shrunk, and in which kind it is saved again.
const P = require('../renderer/picture.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const MB = 1024 * 1024;
const f = (type, size) => ({ type, size });
const d = (width, height) => ({ width, height });

ok('the standard quality is Original, an unknown value is Original too', P.DEFAULT_LEVEL === 'original' && P.levelOf(undefined) === 'original' && P.levelOf('banana') === 'original' && P.levelOf('high') === 'high' && P.levelOf('standard') === 'standard');
ok('the three qualities are offered in this order', P.LEVELS.map(l => l[0]).join() === 'original,high,standard');

// original
ok('original: a picture that fits is saved exactly as it came (JPEG, PNG, WebP, GIF)', ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].every(t => P.plan(f(t, 3 * MB), d(3000, 2000), 'original', 512).keep === true));
ok('original: the 4000 px limit is the longest side, so 4000 itself is kept and 4001 is shrunk', P.plan(f('image/png', MB), d(4000, 3000), 'original', 512).keep === true && P.plan(f('image/png', MB), d(4001, 3000), 'original', 512).keep === false);
ok('original: a picture over 4000 px is shrunk to 4000 px with the same shape, a JPEG stays a JPEG (92%)', (() => { const p = P.plan(f('image/jpeg', 6 * MB), d(6000, 3000), 'original', 512); return !p.keep && p.width === 4000 && p.height === 2000 && p.mime === 'image/jpeg' && p.quality === 0.92; })());
ok('original: anything that is not a JPEG is saved again as a PNG (its transparency is kept)', ['image/png', 'image/webp', 'image/gif', ''].every(t => { const p = P.plan(f(t, MB), d(5000, 5000), 'original', 512); return !p.keep && p.mime === 'image/png' && p.width === 4000 && p.height === 4000; }));
ok('original: a file over 12 MB is always saved again, even when it is small in pixels', (() => { const p = P.plan(f('image/png', 13 * MB), d(1000, 1000), 'original', 512); return !p.keep && p.width === 1000 && p.height === 1000 && p.mime === 'image/png'; })() && P.plan(f('image/png', 12 * MB), d(1000, 1000), 'original', 512).keep === true);
ok('original ignores the size the place was made for', P.plan(f('image/jpeg', MB), d(3000, 2000), 'original', 256).keep === true);

// high
ok('high: nothing is larger than 2000 px, a picture that fits is kept as it is', P.plan(f('image/jpeg', MB), d(2000, 1500), 'high', 256).keep === true && (() => { const p = P.plan(f('image/jpeg', 5 * MB), d(4000, 3000), 'high', 256); return !p.keep && p.width === 2000 && p.height === 1500 && p.mime === 'image/jpeg'; })());
ok('high: a tall picture is limited on its height', (() => { const p = P.plan(f('image/png', MB), d(1000, 4000), 'high', 256); return !p.keep && p.width === 500 && p.height === 2000; })());

// standard
ok('standard: always saved again, at most the size the place was made for, never enlarged', (() => { const a = P.plan(f('image/jpeg', MB), d(3000, 2000), 'standard', 512), b = P.plan(f('image/png', 1000, 100), d(100, 100), 'standard', 512);
  return !a.keep && a.width === 512 && a.height === 341 && a.mime === 'image/jpeg' && a.quality === 0.85 && !b.keep && b.width === 100 && b.height === 100 && b.mime === 'image/png'; })());
ok('standard: a PNG or WebP with transparency is saved as a PNG, not as a JPEG with a white background (the bug of the older versions)', ['image/png', 'image/webp', 'image/gif'].every(t => { const p = P.plan(f(t, 100000), d(800, 800), 'standard', 512); return p.mime === 'image/png' && p.width === 512; }));

// odd input
ok('a vector picture (SVG) is kept, however large it says it is', P.plan(f('image/svg+xml', 20000), d(9000, 9000), 'original', 512).keep === true && P.plan(f('image/svg+xml', 20000), d(9000, 9000), 'high', 512).keep === true && P.plan(f('image/svg+xml', 20000), d(9000, 9000), 'standard', 512).keep === false);
ok('missing or zero sizes never give a picture of 0 px', (() => { const p = P.plan(f('image/png', 1), d(0, 0), 'standard', 512), q = P.plan(undefined, undefined, 'high'); return p.width >= 1 && p.height >= 1 && q.keep === true; })());
ok('the note under the picture sets points to the setting', P.NOTE.includes('App Settings') && P.NOTE.includes('Pictures'));

// load: the whole way from the chosen file to the address that is kept, with a stand-in for the page
const world = (naturalWidth, naturalHeight, broken) => { const log = { revoked: 0, drawn: null, fill: null, saved: null, read: 0 };
  const env = { url: { create: () => 'blob:x', revoke: () => { log.revoked++; } },
    newImage: () => { const im = { naturalWidth, naturalHeight, set src(v) { setTimeout(() => (broken ? im.onerror() : im.onload()), 0); } }; return im; },
    newCanvas: (w, h) => ({ getContext: () => ({ set fillStyle(v) { log.fill = v; }, fillRect() {}, drawImage: (i, x, y, dw, dh) => { log.drawn = [dw, dh]; } }), toDataURL: (mime, q) => { log.saved = [mime, q, w, h]; return 'data:' + mime + ';base64,NEW'; } }),
    read: async f => { log.read++; return 'data:' + f.type + ';base64,ORIGINAL'; } };
  return { env, log }; };
(async () => {
  let w = world(3000, 2000);
  ok('load, original: a picture that fits is read as it is, nothing is drawn (its transparency and bytes stay)', await P.load(f('image/png', MB), 512, 'original', w.env) === 'data:image/png;base64,ORIGINAL' && w.log.read === 1 && w.log.drawn === null && w.log.revoked === 1);
  w = world(6000, 4000);
  ok('load, original: a picture over 4000 px is drawn at 4000 and saved as a JPEG at 92% on a white ground', await P.load(f('image/jpeg', 5 * MB), 512, 'original', w.env) === 'data:image/jpeg;base64,NEW' && JSON.stringify(w.log.saved) === '["image/jpeg",0.92,4000,2667]' && w.log.fill === '#fff' && w.log.read === 0);
  w = world(800, 800);
  ok('load, standard: a WebP is saved as a PNG without a white ground, so its transparency stays (the older versions made it a JPEG with a white background)', await P.load(f('image/webp', 90000), 512, 'standard', w.env) === 'data:image/png;base64,NEW' && w.log.saved[0] === 'image/png' && w.log.fill === null && JSON.stringify(w.log.drawn) === '[512,512]');
  w = world(800, 600);
  ok('load, standard: a JPEG is saved at 85% and the size the place was made for', await P.load(f('image/jpeg', 200000), 512, 'standard', w.env) === 'data:image/jpeg;base64,NEW' && JSON.stringify(w.log.saved) === '["image/jpeg",0.85,512,384]');
  w = world(10, 10, true);
  let err = ''; try { await P.load(f('text/plain', 5), 512, 'original', w.env); } catch (x) { err = x.message; }
  ok('load: a file that is not a picture says so (and gives the temporary address back)', err === 'That file is not a picture.' && w.log.revoked === 1);
  w = world(100, 100); w.env.read = async () => { throw new Error('That file could not be read.'); };
  err = ''; try { await P.load(f('image/png', 10), 512, 'original', w.env); } catch (x) { err = x.message; }
  ok('load: a file that cannot be read is an error, not a silent empty picture', err === 'That file could not be read.');
  console.log(fails ? `\n${fails} PICTURE TESTS FAILED` : '\npicture: all PASSED');
  process.exit(fails ? 1 : 0);
})();
