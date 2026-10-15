// The standard avatars of the lanes (avatars.js) and how the Avatar widget chooses between them, a picture set and the driver's own picture.
const Av = require('../renderer/avatars.js');
const W = require('../renderer/widgets.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };

ok('there are eight standard avatars, one for each lane, all different, in the renderer folder', Av.LANES === 8 && Av.STANDARD.length === 8 && new Set(Av.STANDARD).size === 8 && Av.STANDARD.every((u, i) => u === 'avatars/Lane' + (i + 1) + '.png'));
{ const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
  const head = f => { const b = fs.readFileSync(path.join(root, 'renderer', f)); return { sig: b.subarray(0, 8).toString('hex'), w: b.readUInt32BE(16), h: b.readUInt32BE(20), depth: b[24], type: b[25], size: b.length }; };
  ok('every standard avatar is a PNG file that is there: 768 x 768 pixels with a transparent background (colour type 6, an alpha channel), as made', Av.STANDARD.every(f => { const h = head(f); return h.sig === '89504e470d0a1a0a' && h.w === 768 && h.h === 768 && h.depth === 8 && h.type === 6 && h.size > 100000; }));
  ok('...and they are in the installer (the whole renderer folder is)', require('../package.json').build.files.includes('renderer/**'));
  ok('the address of a standard avatar is plain: nothing that could break out of an attribute', Av.STANDARD.every(u => /^[A-Za-z0-9\/._-]+$/.test(u))); }
ok('forLane gives the standard avatar of the lane (lane 0 is lane 1)', Av.forLane({}, 0) === Av.STANDARD[0] && Av.forLane(undefined, 7) === Av.STANDARD[7] && Av.forLane({}, 3) === Av.STANDARD[3]);
ok('...a lane that does not exist has none (and so does anything that is not a lane)', Av.forLane({}, -1) === '' && Av.forLane({}, 8) === '' && Av.forLane({}, NaN) === '' && Av.forLane({}, undefined) === '' && Av.forLane({}, '2') === Av.STANDARD[2]);
ok('a set replaces the avatars lane by lane; a lane the set leaves empty keeps the standard one', (() => { const o = { laneAvatars: { 1: 'data:image/png;base64,AA', 3: '' } }; return Av.forLane(o, 0) === 'data:image/png;base64,AA' && Av.forLane(o, 1) === Av.STANDARD[1] && Av.forLane(o, 2) === Av.STANDARD[2]; })());
ok('"No avatars" gives nothing, whatever a set says', Av.forLane({ imageSet: 'none' }, 0) === '' && Av.forLane({ imageSet: 'none', laneAvatars: { 1: 'x' } }, 0) === '');
ok('a damaged set (not an object, a number instead of a picture) is ignored', Av.forLane({ laneAvatars: 'oops' }, 0) === Av.STANDARD[0] && Av.forLane({ laneAvatars: { 1: 42 } }, 0) === Av.STANDARD[0] && Av.forLane({ laneAvatars: null }, 0) === Av.STANDARD[0]);

// the widget
const d = W.def('avatar');
ok('the Avatar widget has a choice of avatars, a Mirror tick box and the position and zoom', d.options.map(o => o.key).join() === 'imageSet,avatarMirror,frame' && d.options[0].kind === 'avatars' && d.options[0].type === 'imageset' && d.options[1].type === 'checkbox' && d.options[1].default === false);
ok('its sample in the editor shows the standard avatar of the lane, or the letter when there are none', W.sampleOf(d, 2, { opt: {} }).includes(Av.STANDARD[2]) && W.sampleOf(d, 2, { opt: { imageSet: 'none' } }).includes('class="av"') && W.sampleOf(d, 0, { opt: { avatarMirror: true } }).includes('scaleX(-1)'));
ok('a picture set of avatars is filled in by resolveOpt; any other kind of set is not', W.resolveOpt({ type: 'avatar', opt: { imageSet: 'a' } }, [{ id: 'a', kind: 'avatars', images: { 2: 'p' } }]).laneAvatars[2] === 'p' && W.resolveOpt({ type: 'avatar', opt: { imageSet: 'a' } }, [{ id: 'a', kind: 'fuel', images: ['p'] }]).laneAvatars === undefined);
ok('avatarHtml: the frame, the zoom and the mirror, and a picture address cannot break out of the page', (() => { const h = W.avatarHtml('a"b<c', { avatarMirror: true, frame: { zoom: 2, x: 0, y: 0 } }); return h.startsWith('<span class="avframe"><img class="avimg"') && h.includes('src="a&quot;b&lt;c"') && h.includes('scale(2) scaleX(-1)'); })());

console.log(fails ? `\n${fails} AVATAR TESTS FAILED` : '\navatars: all PASSED');
process.exit(fails ? 1 : 0);
