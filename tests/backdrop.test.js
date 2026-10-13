// The background picture of a timing page and its filters (renderer/backdrop.js)
const B = require('../renderer/backdrop.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const PIC = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';

// the picture
ok('a layout without a picture has no background layer at all', !B.has({}) && !B.has(undefined) && !B.has(null) && B.css({}) === '' && B.html({}) === '');
ok('a picture embedded in the layout (png, jpeg, webp, gif) is used', ['png', 'jpeg', 'jpg', 'webp', 'gif'].every(t => B.has({ bgImage: `data:image/${t};base64,iVBORw0KGgo=` })));
ok('anything that points elsewhere is not used', ['http://x/y.png', 'https://x/y.png', 'file:///c:/y.png', 'javascript:alert(1)', 'data:text/html;base64,AAAA', 'data:image/svg+xml;base64,AAAA', 'data:image/png;utf8,<svg>', 'url(x)', '', ' ', null, 5, {}, [], true, PIC + '"); background:url(http://x', PIC + ' ', 'data:image/png;base64,AA AA'].every(v => !B.has({ bgImage: v })));

// the three filters and the fit, with what happens to rubbish
ok('no filters set: sharp, as bright as it is, in full colour', B.blur({}) === 0 && B.brightness({}) === 100 && B.saturation({}) === 100 && B.fit({}) === 'cover');
ok('blur is 0 to 100, brightness 20 to 150, colour 0 to 200, all whole numbers', B.blur({ bgBlur: 40.4 }) === 40 && B.blur({ bgBlur: '55' }) === 55 && B.blur({ bgBlur: 500 }) === 100 && B.blur({ bgBlur: -5 }) === 0 && B.brightness({ bgBrightness: 10 }) === 20 && B.brightness({ bgBrightness: 999 }) === 150 && B.saturation({ bgSaturation: 0 }) === 0 && B.saturation({ bgSaturation: 999 }) === 200);
ok('rubbish is the default', ['', ' ', 'x', null, NaN, true, {}, []].every(v => B.blur({ bgBlur: v }) === 0 && B.brightness({ bgBrightness: v }) === 100 && B.saturation({ bgSaturation: v }) === 100));
ok('a fit is cover, contain or stretch; anything else is cover', ['cover', 'contain', 'stretch'].every(f => B.fit({ bgFit: f }) === f) && ['x', 5, null, 'COVER', 'fill'].every(f => B.fit({ bgFit: f }) === 'cover'));

// the style of the layer
const css = l => B.css({ bgImage: PIC, ...l });
ok('a picture alone: fills the page, no filter, no push out', css({}) === `background-image:url('${PIC}');background-repeat:no-repeat;background-position:center;background-size:cover`);
ok('fit contain and stretch', css({ bgFit: 'contain' }).includes('background-size:contain') && css({ bgFit: 'stretch' }).includes('background-size:100% 100%'));
ok('blur is in cqw (a share of the page width) so it looks the same at any size: 100 is 4cqw', css({ bgBlur: 100 }).includes('filter:blur(4cqw)') && css({ bgBlur: 50 }).includes('filter:blur(2cqw)') && css({ bgBlur: 1 }).includes('filter:blur(0.04cqw)'));
ok('a blurred picture is pushed out of the page by twice the blur, so its soft edge is not seen', css({ bgBlur: 50 }).includes(';inset:-4cqw') && css({ bgBlur: 100 }).includes(';inset:-8cqw') && !css({}).includes('inset'));
ok('brightness and colour', css({ bgBrightness: 60 }).includes('filter:brightness(60%)') && css({ bgSaturation: 0 }).includes('filter:saturate(0%)'));
ok('filters together, in one order', css({ bgBlur: 50, bgBrightness: 70, bgSaturation: 50 }).includes('filter:blur(2cqw) brightness(70%) saturate(50%)'));
ok('filters at their neutral values are not written', !css({ bgBrightness: 100, bgSaturation: 100, bgBlur: 0 }).includes('filter'));
ok('the layer is its own element, and its style can sit inside a double-quoted attribute', (() => { const h = B.html({ bgImage: PIC, bgBlur: 20 }); const m = /^<div class="bgpic" style="([^"]*)"><\/div>$/.exec(h); return !!m && m[1] === B.css({ bgImage: PIC, bgBlur: 20 }); })());
ok('a hostile picture or filter adds nothing to the style', B.css({ bgImage: 'x";background:url(http://evil)', bgBlur: '5;x:y' }) === '');

// what a layout keeps
ok('pick keeps the five settings, cleaned', JSON.stringify(B.pick({ bgImage: PIC, bgFit: 'contain', bgBlur: 30.2, bgBrightness: 80, bgSaturation: 120 })) === JSON.stringify({ bgImage: PIC, bgFit: 'contain', bgBlur: 30, bgBrightness: 80, bgSaturation: 120 }));
ok('...and for a layout without any: empty picture and neutral filters', JSON.stringify(B.pick({})) === JSON.stringify({ bgImage: '', bgFit: 'cover', bgBlur: 0, bgBrightness: 100, bgSaturation: 100 }) && B.pick({ bgImage: 'http://x' }).bgImage === '');

if (fails) { console.log('\n' + fails + ' FAILED'); process.exit(1); }
console.log('ALL BACKDROP TESTS PASSED');
