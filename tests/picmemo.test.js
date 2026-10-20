// 1.60.2: the text of a picture is built once (renderer/picmemo.js), and the widgets that have a picture use it; a widget is compared part by part (renderer/canvas.js).
// The same picture with the same settings gives the very same text object again; another picture or another setting gives another text; small pictures are not remembered.
const path = require('path');
const R = path.join(__dirname, '..') + '/';
const PM = require(R + 'renderer/picmemo.js');
const Wd = require(R + 'renderer/widgets.js');
const WW = require(R + 'renderer/weatherwidgets.js');
let fails = 0;
const say = (m, c) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const pic = (n, ch = 'A') => 'data:image/jpeg;base64,' + ch.repeat(n);

// ---- the helper ----
{ const s = PM.site(); let built = 0; const mk = () => { built++; return 'x'.repeat(10) + built; };
  const big = pic(5000), a = PM.once(s, [big, 1], mk), b = PM.once(s, [big, 1], mk);
  say('a big picture with the same settings: made once, the very same text comes back', built === 1 && a === b);
  const c = PM.once(s, [big, 2], mk);
  say('...another setting: made again', built === 2 && c !== a);
  const d = PM.once(s, [big, 1], mk);
  say('...and the first one is still remembered', built === 2 && d === a);
  const other = pic(5000, 'B'); PM.once(s, [other, 1], mk);
  say('another picture of the same size: made again (not mistaken for the first)', built === 3);
  const small = 'data:image/png;base64,AAAA'; let sb = 0; const s2 = PM.site(); PM.once(s2, [small], () => ++sb); PM.once(s2, [small], () => ++sb);
  say('a small picture is made again each time (cheap, and not kept)', sb === 2 && s2.list.length === 0);
  let nb = 0; PM.once(null, [big], () => ++nb); PM.once(null, [big], () => ++nb);
  say('without a place to remember in it simply builds', nb === 2);
  // limits: the number of pictures kept, and the amount of text
  const s3 = PM.site(); for (let i = 0; i < PM.MAX_ENTRIES + 5; i++) PM.once(s3, [pic(3000, String.fromCharCode(65 + (i % 26))) + i], () => 'y'.repeat(3000));
  say('only a number of pictures are kept, the newest', s3.list.length === PM.MAX_ENTRIES);
  const s4 = PM.site(); const hugeBuilder = () => 'z'.repeat(1e6); let k = 0; for (let i = 0; i < 20; i++) PM.once(s4, [pic(3000) + i], hugeBuilder);
  say('the text kept is counted: it stays within the limit (here 16 entries of one million characters)', s4.chars === s4.list.reduce((t, e) => t + e.size, 0) && s4.chars <= PM.MAX_CHARS);
  const s5 = PM.site(); const seventy = () => 'q'.repeat(70e6); PM.once(s5, [pic(3000) + 'a'], seventy); PM.once(s5, [pic(3000) + 'b'], seventy);
  say('when the text kept gets over the limit the oldest is let go, and the count is right after that', s5.list.length === 1 && s5.chars === 70e6 && s5.list[0].deps[0].endsWith('b'));
  { const s7 = PM.site(); let k7 = 0; const m7 = () => ++k7; const bg = pic(3000);
    PM.once(s7, [bg], m7); PM.once(s7, [bg, undefined], m7);
    say('settings that are not the same length are not the same settings', k7 === 2);
    PM.once(s7, [bg, 1], m7); PM.once(s7, [bg, '1'], m7); PM.once(s7, [bg, 0], m7); PM.once(s7, [bg, false], m7); PM.once(s7, [bg, null], m7); PM.once(s7, [bg, undefined], m7);
    say('...nor are 1 and "1", 0 and false, null and undefined (the settings are compared strictly)', k7 === 7);
    const s8 = PM.site(); const m8 = i => () => i; const bigs = Array.from({ length: PM.MAX_ENTRIES }, (_, i) => pic(3000, 'A') + i);
    bigs.forEach((b2, i) => PM.once(s8, [b2], m8(i)));
    let made = 0; PM.once(s8, [bigs[0]], () => { made++; return 'x'; }); // the oldest is asked for again: it is the one used last now
    PM.once(s8, [pic(3000, 'B')], m8('new'));
    PM.once(s8, [bigs[0]], () => { made++; return 'x'; });
    say('the picture that is used again is kept when a new one pushes the oldest out (the one used last comes first)', made === 0 && s8.list.length === PM.MAX_ENTRIES); }
  const s6 = PM.site(); let r6 = 0; const huge = () => { r6++; return 'h'.repeat(PM.MAX_CHARS + 1); };
  const h1 = PM.once(s6, [pic(3000)], huge), h2 = PM.once(s6, [pic(3000)], huge);
  say('one text bigger than the limit is still kept (the one just made is never let go)', s6.list.length === 1 && r6 === 1 && h1 === h2);
}

// ---- the widgets ----
const count = k => Wd.picSites[k].list.length;
const big = pic(6000), frame = { zoom: 1.5 };
{ const a = Wd.avatarHtml(big, { frame }), b = Wd.avatarHtml(big, { frame });
  say('the avatar / car picture: the same picture gives the very same text', a === b && a.includes('class="avframe"') && a.includes(big));
  say('...with another frame it is another text', Wd.avatarHtml(big, { frame: { zoom: 2 } }) !== a);
  say('...mirrored it is another text, with the flip in it', Wd.avatarHtml(big, { frame, avatarMirror: true }).includes('scaleX(-1)') && !a.includes('scaleX(-1)'));
  { const before = count('av'); Wd.avatarHtml(big, { frame }); Wd.avatarHtml(big, { frame }); say('...it is made once and kept (one place in the memory, not two)', count('av') === before);
    const other = pic(6000, 'Q'); Wd.avatarHtml(other, { frame }); Wd.avatarHtml(other, { frame });
    say('...another picture is another place in the memory', count('av') === before + 1); }
  say('...and the text of a small picture is as it always was', Wd.avatarHtml('x.png', {}) === '<span class="avframe"><img class="avimg" src="x.png" alt="" style="transform:' + Wd.frameTransform(undefined) + '"></span>');
}
{ Wd.imageHtml(big, 'cover'); Wd.imageHtml(big, 'cover'); say('an image widget: made once and kept', count('img') === 1);
  const a = Wd.imageHtml(big, 'cover'), b = Wd.imageHtml(big, 'cover');
  say('an image widget (logo, image per lane or race): the same text again', a === b && a.includes('object-fit:cover') && Wd.imageHtml(big, 'contain') !== a && !Wd.imageHtml(big, 'contain').includes('object-fit') && Wd.imageHtml('', 'cover') === '');
}
{ const a = Wd.flagImgHtml(big, 'Red flag', true), b = Wd.flagImgHtml(big, 'Red flag', true);
  say('the race flag picture: the same text again, with the words and the flip', a === b && a.includes('alt="Red flag"') && a.includes('scaleX(-1)') && Wd.flagImgHtml(big, 'Yellow flag', true) !== a && Wd.flagImgHtml(big, 'Red flag', false) !== a);
}
{ const pics = { on: pic(5000, 'C'), off: pic(5000, 'D') };
  const a = Wd.lightsHtml(2, pics, '#f00'), b = Wd.lightsHtml(2, pics, '#f00');
  say('the start lights with pictures: the same text again', a === b && (a.match(/<image /g) || []).length === 5 && a.includes(pics.on) && a.includes(pics.off));
  const c = Wd.lightsHtml(3, pics, '#f00');
  say('...one more light on: another text, with the right pictures', c !== a && c.split(pics.on).length === 4 && c.split(pics.off).length === 3);
  const d = Wd.lightsHtml(2, { on: pic(5000, 'E'), off: pics.off }, '#f00');
  say('...another picture of the same length: another text', d !== a && d.includes(pic(5000, 'E')) && !d.includes(pics.on));
  const e = Wd.lightsHtml(2, { pick: (i, lit) => (lit ? pics.on : pics.off) }, '');
  { const nB = count('lights');
    const same1 = Wd.lightsHtml(2, { on: big, off: big }, ''), same2 = Wd.lightsHtml(3, { on: big, off: big }, '');
    say('...the same picture for on and off: one more light on is still another text (the class of the light)', same1 !== same2 && (same2.match(/class="sl on"/g) || []).length === 3 && (same1.match(/class="sl on"/g) || []).length === 2);
    const mixA = Wd.lightsHtml(2, { on: '', off: big }, '#f00'), mixB = Wd.lightsHtml(2, { on: '', off: big }, '#0f0');
    say('...a lit light without a picture is a circle in the colour of the widget, and another colour is another text', mixA !== mixB && mixA.includes('fill:#f00') && mixB.includes('fill:#0f0'));
    const pickA = Wd.lightsHtml(1, { pick: i => (i === 4 ? pic(5000, 'M') : pic(5000, 'N')) }, ''), pickB = Wd.lightsHtml(1, { pick: i => (i === 4 ? pic(5000, 'P') : pic(5000, 'N')) }, '');
    say('...a picture that differs in the last light only is another text (all five pictures are looked at)', pickA !== pickB && pickB.includes(pic(5000, 'P')) && !pickB.includes(pic(5000, 'M')) && count('lights') > nB); }
  say('...the picture grid of a set (pick) gives the same text as a pair', e === Wd.lightsHtml(2, pics, '') && e.split('<image ').length === 6);
  const plain = Wd.lightsHtml(3), plain2 = Wd.lightsHtml(3, null, '#0f0');
  say('without pictures the lights are the circles they were (also in a colour)', plain.includes('<circle') && !plain.includes('<image') && plain2.includes('fill:#0f0') && plain === Wd.lightsHtml(3));
}
{ const imgs = Array.from({ length: 10 }, (_, i) => pic(4000, String.fromCharCode(70 + i)));
  const opt = { mode: 'images', steps: 10, stepImages: imgs };
  const a = Wd.fuelHtml(87.3, 100, opt), b = Wd.fuelHtml(87.1, 100, opt), c = Wd.fuelHtml(81, 100, opt);
  say('the fuel picture: filling up by a tenth of a litre gives the very same text (it used to change with every tenth and put the picture in the page again)', a === b && a.includes('class="fuelimg"'));
  say('...the same picture (the same step of the tank) is the same text, a fuller tank is another picture', a === c && Wd.fuelHtml(99, 100, opt) !== a && Wd.fuelHtml(99, 100, opt).includes(imgs[0]) && a.includes(imgs[1]));
  say('...the words of the picture follow the picture, not the litres', !a.includes('87') && /alt="Fuel about \d+%"/.test(a) && a !== Wd.fuelHtml(50, 100, opt));
  { const same = Array.from({ length: 10 }, () => pic(4000, 'Z')), o2 = { mode: 'images', steps: 10, stepImages: same };
    const h1 = Wd.fuelHtml(95, 100, o2), h2 = Wd.fuelHtml(15, 100, o2);
    say('...when the same picture is used for several steps the words still follow the step', h1 !== h2 && h1.includes('Fuel about 100%') !== h2.includes('Fuel about 100%') && count('fuel') >= 1); }
  say('...a full tank and an empty tank say 100% and 0%', /Fuel about 100%/.test(Wd.fuelHtml(100, 100, opt)) && /Fuel about 0%/.test(Wd.fuelHtml(0, 100, opt)));
  say('...the bar and the number are as they were', Wd.fuelHtml(87.5, 120, { mode: 'both' }).includes('class="ffill"') && Wd.fuelHtml(87.5, 120, { mode: 'number' }).includes('87.5 L'));
}
{ const w1 = WW.icon('cond', 'winddir', { winddir: big }, 90, false), w2 = WW.icon('cond', 'winddir', { winddir: big }, 180, false);
  say('a wind direction picture: the direction turns the picture, another direction is another text', w1 !== w2 && w1.includes('rotate(270deg)') && w2.includes('rotate(0deg)'));
  WW.icon('tyre', 'S', { S: big }, 0, false); say('...and the pictures are kept', WW.picSite.list.length >= 3);
  const a = WW.icon('tyre', 'S', { S: big }, 0, false), b = WW.icon('tyre', 'S', { S: big }, 0, false);
  say('a tyre or weather picture from a set: the same text again', a === b && a.includes('class="wxic"') && a.includes(big) && WW.icon('tyre', 'S', { S: big }, 0, true) !== a);
}


// ---- 1.60.6: a big picture as a short link ----
const fs = require('fs');
const keepURL = { c: URL.createObjectURL, r: URL.revokeObjectURL }, made = [], gone = [];
URL.createObjectURL = b => { made.push(b); return 'blob:test/' + made.length; }; URL.revokeObjectURL = u => { gone.push(u); };
const b64 = (n, k = 7) => Buffer.from(Array.from({ length: n }, (_, i) => (i * k + 3) & 255)).toString('base64');
const big1 = 'data:image/png;base64,' + b64(3000), big2 = 'data:image/jpeg;base64,' + b64(3001, 11), big3 = 'data:image/png;base64,' + b64(3002, 13);
{ say('links are off until the app switches them on: a picture is given as it was', PM.link(big1) === big1 && made.length === 0 && PM.linkStats().on === false);
  PM.setLinks(true);
  const u1 = PM.link(big1), copy = Array.from(big1).join('');
  say('on: a big picture becomes a link (blob:...) and is made once', /^blob:/.test(u1) && made.length === 1 && PM.link(big1) === u1 && made.length === 1);
  say('...the same picture as another piece of text gives the same link (it is looked up by what it says)', PM.link(copy) === u1 && made.length === 1);
  say('...the file has the type of the picture and the size of the bytes in it', made[0].type === 'image/png' && made[0].size === 3000);
  const u2 = PM.link(big2);
  say('...another picture is another link, with its own type and size', u2 !== u1 && made.length === 2 && made[1].type === 'image/jpeg' && made[1].size === 3001);
  say('...and the count says what is kept', PM.linkStats().on === true && PM.linkStats().count === 2 && PM.linkStats().bytes === 6001);
  const small = 'data:image/png;base64,AAAA', far = 'file:///pictures/x.png' + 'a'.repeat(3000), svg = 'data:image/svg+xml,' + '%3Csvg%3E'.repeat(400), param = 'data:image/png;charset=x;base64,' + b64(3000), svgA = 'data:image/svg+xml,' + 'A'.repeat(3000);
  say('a small picture, an address, a picture that is not base64 and a header with more in it are given as they were', PM.link(small) === small && PM.link(far) === far && PM.link(svg) === svg && PM.link(svgA) === svgA && PM.link(param) === param && made.length === 2);
  say('...nothing (or something that is not text) stays nothing', PM.link(undefined) === undefined && PM.link('') === '' && PM.link(null) === null && PM.link(42) === 42);
  const bad = 'data:image/png;base64,' + '!!!'.repeat(1500);
  say('a picture that cannot be read is given as it was, without a link', PM.link(bad) === bad && made.length === 2);
  const keepC = URL.createObjectURL; let tries = 0; URL.createObjectURL = () => { tries++; throw new Error('no blobs here'); };
  const odd = 'data:image/png;base64,' + b64(3003, 17), o1 = PM.link(odd), o2 = PM.link(odd);
  URL.createObjectURL = keepC;
  say('when the window cannot make a link the picture is given as it was, and it is not tried again for every light', o1 === odd && o2 === odd && tries === 1);
  const stats = PM.linkStats(); PM.clearLinks();
  say('clearing lets every link go (the files are released, and only those: not the picture that could not be made into a link) and empties the count', gone.length === 2 && gone.includes(u1) && gone.includes(u2) && PM.linkStats().count === 0 && PM.linkStats().bytes === 0 && stats.count >= 3);
  say('...and the same picture is made again after that', PM.link(big1) !== undefined && /^blob:/.test(PM.link(big1)) && PM.link(big1) !== u1);
  PM.clearLinks();
  const nm = 'data:;base64,' + b64(3006, 43); PM.link(nm);
  say('a picture that says nothing about its type is given the type image/png', made[made.length - 1].type === 'image/png' && made[made.length - 1].size === 3006);
  PM.clearLinks();
  // limits: the number of pictures and the bytes they hold; the oldest is let go
  gone.length = 0; PM.MAX_LINKS = 3;
  const five = [1, 2, 3, 4, 5].map(i => 'data:image/png;base64,' + b64(3000 + i, 19 + i)), five1 = five.map(x => PM.link(x));
  say('only a number of pictures are kept as links: the newest', PM.linkStats().count === 3 && gone.length === 2 && gone[0] === five1[0] && gone[1] === five1[1]);
  const nBefore = made.length; const again = PM.link(five[0]);
  say('...a picture that was let go is made again when it is asked for', made.length === nBefore + 1 && again !== five1[0]);
  PM.MAX_LINKS = 256; PM.clearLinks(); gone.length = 0; PM.MAX_LINK_BYTES = 7000;
  const three = [1, 2, 3].map(i => 'data:image/png;base64,' + b64(3000, 30 + i)); three.forEach(x => PM.link(x));
  say('the bytes kept are counted too: over the limit the oldest are let go (here 2 of 3 pictures of 3000 bytes stay)', PM.linkStats().count === 2 && PM.linkStats().bytes === 6000 && gone.length === 1);
  PM.MAX_LINK_BYTES = 6000; PM.clearLinks(); gone.length = 0; three.slice(0, 2).forEach(x => PM.link(x));
  say('...exactly at the limit is still within it', PM.linkStats().count === 2 && PM.linkStats().bytes === 6000 && gone.length === 0);
  PM.MAX_LINK_BYTES = 10; PM.clearLinks(); const onlyOne = PM.link(big1);
  say('...but the picture that was just made is never the one let go', /^blob:/.test(onlyOne) && PM.linkStats().count === 1);
  PM.MAX_LINK_BYTES = 256e6; PM.clearLinks();
  // reading the bytes: the browser's own reader when it has one, else atob; both give the same bytes
  const keepFrom = Uint8Array.fromBase64; let fromCalls = 0;
  Uint8Array.fromBase64 = s => { fromCalls++; return new Uint8Array(Buffer.from(s, 'base64')); };
  const viaFrom = 'data:image/png;base64,' + b64(3004, 23); PM.link(viaFrom);
  say('the reader of the browser is used when it is there', fromCalls === 1 && made[made.length - 1].size === 3004);
  Uint8Array.fromBase64 = undefined; const viaAtob = 'data:image/png;base64,' + b64(3005, 29); PM.link(viaAtob);
  say('...and atob when it is not', fromCalls === 1 && made[made.length - 1].size === 3005);
  if (keepFrom) Uint8Array.fromBase64 = keepFrom; else delete Uint8Array.fromBase64;
  PM.clearLinks();
}
{ // the start lights
  PM.setLinks(true); const lk = PM.link(big3), g0 = gone.length; PM.setLinks(false);
  say('switching the links off lets every link go and the pictures are given as they were again', gone.length === g0 + 1 && gone[gone.length - 1] === lk && PM.linkStats().count === 0 && PM.link(big3) === big3);
  const onP = 'data:image/png;base64,' + b64(6000, 31), offP = 'data:image/png;base64,' + b64(6001, 37), pics = { pick: (i, lit) => (lit ? onP : offP) };
  PM.setLinks(false); PM.clearLinks(); made.length = 0; Wd.picSites.lights.list.length = 0; Wd.picSites.lights.chars = 0;
  const off = Wd.lightsHtml(2, pics, '#f00');
  say('the start lights without links carry the pictures themselves (as before)', off.includes(onP) && off.includes(offP) && off.length > 12000 && made.length === 0);
  PM.setLinks(true); Wd.picSites.lights.list.length = 0; Wd.picSites.lights.chars = 0;
  const a = Wd.lightsHtml(2, pics, '#f00'), links = a.match(/href="([^"]*)"/g) || [];
  say('...with links the five lights carry short links: the text is small, there is no picture in it', links.length === 5 && links.every(l => /^href="blob:test\/\d+"$/.test(l)) && a.length < 1500 && !a.includes('base64'));
  say('...only two files were made (one for the lit light and one for the dark one), the lit lights share one link', made.length === 2 && new Set(links).size === 2 && links.filter(l => l === links[0]).length === 2);
  const b = Wd.lightsHtml(3, pics, '#f00');
  say('...another number of lights on is another text but no new file is made', b !== a && made.length === 2 && (b.match(/class="sl on"/g) || []).length === 3 && (a.match(/class="sl on"/g) || []).length === 2);
  say('...the same lights again: the very same text', Wd.lightsHtml(3, pics, '#f00') === b);
  const mixed = Wd.lightsHtml(1, { pick: (i, lit) => (i === 4 ? 'data:image/png;base64,AAAA' : lit ? onP : offP) }, '');
  say('...a small picture in one light stays as it is, the big ones are links', mixed.includes('href="data:image/png;base64,AAAA"') && (mixed.match(/href="blob:/g) || []).length === 4);
  const plain = Wd.lightsHtml(3);
  say('the plain round lights are what they were', plain.includes('<circle') && !plain.includes('<image') && !plain.includes('blob:'));
  // a widget that has no PicMemo.link (an older stand-in) still gets its picture
  say('the start lights know their pictures by the text: the grid pick and the pair give the same links', Wd.lightsHtml(2, { on: onP, off: offP }, '#f00') === a);
}
{ // the app turns it on, before it draws anything
  const app = fs.readFileSync(R + 'renderer/app.js', 'utf8'), wid = fs.readFileSync(R + 'renderer/widgets.js', 'utf8'), idx = fs.readFileSync(R + 'renderer/index.html', 'utf8');
  const on = app.indexOf('PicMemo.setLinks(true)'), live = app.indexOf("location.hash === '#live'"), render = app.indexOf('  render();\n', on);
  say('app.js switches the links on at the start, for the race window and for the second screen (before the #live branch and before anything is drawn)', on > 0 && live > on && render > live);
  say('the start lights ask for the link of each picture', /<image class="\$\{cls\}" href="\$\{esc\(link\(src\)\)\}"/.test(wid) && /const link = src => \(PM && typeof PM\.link === 'function' \? PM\.link\(src\) : src\)/.test(wid));
  say('picmemo.js is loaded before widgets.js', idx.indexOf('picmemo.js') > 0 && idx.indexOf('picmemo.js') < idx.indexOf('src="widgets.js"'));
}
PM.setLinks(false); URL.createObjectURL = keepURL.c; URL.revokeObjectURL = keepURL.r;

// the bytes in a file made for a picture are the bytes of the picture
(async () => {
  URL.createObjectURL = b => { made.push(b); return 'blob:test/' + made.length; };
  PM.setLinks(true); const keepFrom = Uint8Array.fromBase64;
  for (const reader of ['the reader of the browser', 'atob']) {
    Uint8Array.fromBase64 = reader === 'atob' ? undefined : (keepFrom || (x => new Uint8Array(Buffer.from(x, 'base64'))));
    const n0 = made.length, src = 'data:image/png;base64,' + b64(4000, reader === 'atob' ? 41 : 47); PM.link(src);
    const got = Buffer.from(await made[n0].arrayBuffer()), want = Buffer.from(src.split(',')[1], 'base64');
    say('the file made for a picture holds exactly the bytes of the picture (read with ' + reader + ')', got.length === 4000 && got.equals(want));
  }
  if (keepFrom) Uint8Array.fromBase64 = keepFrom; else delete Uint8Array.fromBase64;
  PM.setLinks(false); URL.createObjectURL = keepURL.c;
  console.log(fails ? `\n${fails} FAILED` : '\npicmemo PASSED');
  process.exit(fails ? 1 : 0);
})();
