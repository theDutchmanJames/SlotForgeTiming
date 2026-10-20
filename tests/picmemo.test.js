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

console.log(fails ? `\n${fails} FAILED` : '\npicmemo PASSED');
process.exit(fails ? 1 : 0);
