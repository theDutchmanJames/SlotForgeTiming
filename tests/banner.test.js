// The Home header picture: height, position and dragging (renderer/banner.js)
const B = require('../renderer/banner.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// height
ok('a height from 5 to 60 is used', [5, 18, 60].every(n => B.height({ homeHeaderHeight: n }) === n));
ok('a height is rounded, and a number in text is read', B.height({ homeHeaderHeight: 24.6 }) === 25 && B.height({ homeHeaderHeight: '32' }) === 32);
ok('no height, or one outside 5 to 60, or rubbish, is automatic (0)', [undefined, null, '', 'x', 0, 4, 61, -5, NaN, {}].every(v => B.height({ homeHeaderHeight: v }) === 0) && B.height({}) === 0);

// position
ok('with nothing saved the picture is in the middle', same(B.pos({}), { x: 50, y: 50 }) && same(B.pos(undefined), { x: 50, y: 50 }) && same(B.pos(null), { x: 50, y: 50 }));
ok('a saved position is used', same(B.pos({ homeHeaderPos: { x: 20, y: 80 } }), { x: 20, y: 80 }) && same(B.pos({ homeHeaderPos: { x: 0, y: 100 } }), { x: 0, y: 100 }));
ok('a position is kept to one decimal and to 0 to 100', same(B.pos({ homeHeaderPos: { x: 33.333, y: 66.66 } }), { x: 33.3, y: 66.7 }) && same(B.pos({ homeHeaderPos: { x: -20, y: 250 } }), { x: 0, y: 100 }));
ok('a position in text is read', same(B.pos({ homeHeaderPos: { x: '30', y: ' 70 ' } }), { x: 30, y: 70 }));
ok('one bad value only affects itself', same(B.pos({ homeHeaderPos: { x: 'left', y: 10 } }), { x: 50, y: 10 }));
ok('rubbish is the middle', [null, '', ' ', 'x', true, false, NaN, Infinity, {}, [], '50%;background:url(x)'].every(v => same(B.pos({ homeHeaderPos: { x: v, y: v } }), { x: 50, y: 50 })));
ok('a position that is not an object is the middle', ['abc', 5, true, [], null].every(v => same(B.pos({ homeHeaderPos: v }), { x: 50, y: 50 })));

// the style of the picture
ok('automatic height and the middle: no style of its own', B.css({}) === '' && B.css({}, '') === '');
ok('automatic height keeps the style it is given', B.css({}, 'max-height:110px') === 'max-height:110px');
ok('a set height', B.css({ homeHeaderHeight: 25 }) === 'aspect-ratio:100 / 25;max-height:none');
ok('a position away from the middle is added', B.css({ homeHeaderHeight: 25, homeHeaderPos: { x: 30, y: 70 } }) === 'aspect-ratio:100 / 25;max-height:none;object-position:30% 70%');
ok('...also with automatic height', B.css({ homeHeaderPos: { x: 0, y: 12.5 } }, 'max-height:110px') === 'max-height:110px;object-position:0% 12.5%');
ok('a given style is not used when the height is set', !B.css({ homeHeaderHeight: 25 }, 'max-height:110px').includes('110'));
ok('one side in the middle is still written', B.css({ homeHeaderPos: { x: 50, y: 80 } }) === 'object-position:50% 80%');
ok('a hostile height or position adds nothing to the style', B.css({ homeHeaderHeight: '25;x:y', homeHeaderPos: { x: '5%;background:url(x)', y: 'url(x)' } }) === '');

// how far the picture sticks out of its box
ok('a picture of the same shape as the box fits: nothing can move', same(B.overflow({ w: 1000, h: 250 }, { w: 1600, h: 400 }), { x: 0, y: 0 }));
ok('a tall picture in a wide box sticks out at the bottom: it can move up and down', same(B.overflow({ w: 1000, h: 250 }, { w: 1000, h: 1000 }), { x: 0, y: 750 }));
ok('a very wide picture sticks out at the sides: it can move left and right', same(B.overflow({ w: 1000, h: 250 }, { w: 3000, h: 500 }), { x: 500, y: 0 }));
ok('sizes that are not known mean nothing can move', [[{ w: 0, h: 0 }, { w: 10, h: 10 }], [{ w: 100, h: 50 }, { w: 0, h: 0 }], [{ w: NaN, h: 5 }, { w: 3, h: 3 }], [{}, {}]].every(([b, n]) => same(B.overflow(b, n), { x: 0, y: 0 })));

// dragging
const box = { w: 1000, h: 250 }, tall = { w: 1000, h: 1000 }, wide = { w: 3000, h: 500 }, mid = { x: 50, y: 50 };
ok('dragging the picture up shows more of its bottom', same(B.drag(box, tall, mid, 0, -75), { x: 50, y: 60 }));
ok('dragging it down shows more of its top', same(B.drag(box, tall, mid, 0, 75), { x: 50, y: 40 }));
ok('dragging it left shows more of its right side', same(B.drag(box, wide, mid, -100, 0), { x: 70, y: 50 }));
ok('dragging it right shows more of its left side', same(B.drag(box, wide, mid, 100, 0), { x: 30, y: 50 }));
ok('a direction in which the picture fits does not move', same(B.drag(box, tall, mid, 400, 0), mid) && same(B.drag(box, wide, mid, 0, 400), mid));
ok('the picture cannot be dragged past its edge', same(B.drag(box, tall, mid, 0, 5000), { x: 50, y: 0 }) && same(B.drag(box, tall, mid, 0, -5000), { x: 50, y: 100 }));
ok('a drag starts from where the picture was', same(B.drag(box, tall, { x: 50, y: 10 }, 0, -75), { x: 50, y: 20 }));
ok('moving the picture exactly its own room goes from one edge to the other', same(B.drag(box, tall, { x: 50, y: 100 }, 0, 750), { x: 50, y: 0 }));
ok('a drag that ends where it began changes nothing', same(B.drag(box, tall, { x: 50, y: 33.3 }, 0, 0), { x: 50, y: 33.3 }));
ok('a picture that fills its box can only be cropped in one direction: never both can move', [[500, 500, 2000, 1000], [333, 111, 640, 480], [1000, 250, 1000, 1000], [480, 120, 1600, 400], [90, 400, 31, 17]].every(([bw, bh, nw, nh]) => { const o = B.overflow({ w: bw, h: bh }, { w: nw, h: nh }); return Math.min(o.x, o.y) < 1e-9; }));
ok('...and the direction that can move is the one that is dragged', same(B.drag({ w: 500, h: 500 }, { w: 2000, h: 1000 }, mid, -100, 40), { x: 70, y: 50 }));
ok('a drag with unknown sizes changes nothing', same(B.drag({ w: 0, h: 0 }, tall, mid, 100, 100), mid));

// the club logo beside the header picture
ok('the logo goes on the left or the right; anything else means not shown', B.logoSide({ homeLogoSide: 'left' }) === 'left' && B.logoSide({ homeLogoSide: 'right' }) === 'right' && [undefined, null, '', 'top', 'LEFT', 1, true, {}, ['left']].every(v => B.logoSide({ homeLogoSide: v }) === '') && B.logoSide(null) === '' && B.logoSide(undefined) === '');
ok('the logo is on when there is a logo and a side', B.logoOn({ clubLogo: 'data:x', homeLogoSide: 'left' }) === true && B.logoOn({ clubLogo: 'data:x', homeLogoSide: 'right' }) === true);
ok('...not without a logo, not without a side', B.logoOn({ clubLogo: '', homeLogoSide: 'left' }) === false && B.logoOn({ homeLogoSide: 'left' }) === false && B.logoOn({ clubLogo: 'data:x' }) === false && B.logoOn({ clubLogo: 'data:x', homeLogoSide: '' }) === false && B.logoOn({ clubLogo: 5, homeLogoSide: 'left' }) === false && B.logoOn(null) === false);
ok('the logo gets 25 percent of the width unless set', B.logoShare({}) === 25 && B.logoShare(null) === 25);
ok('a share from 10 to 50 is used, rounded; a number in text is read', [10, 25, 33, 50].every(n => B.logoShare({ homeLogoShare: n }) === n) && B.logoShare({ homeLogoShare: 33.6 }) === 34 && B.logoShare({ homeLogoShare: '40' }) === 40);
ok('a share outside 10 to 50 is kept to it', B.logoShare({ homeLogoShare: 3 }) === 10 && B.logoShare({ homeLogoShare: 90 }) === 50 && B.logoShare({ homeLogoShare: -5 }) === 10 && B.logoShare({ homeLogoShare: 0 }) === 10);
ok('a share that is rubbish is 25', [undefined, null, '', ' ', 'x', true, false, NaN, Infinity, {}, [], '30;x:y'].every(v => B.logoShare({ homeLogoShare: v }) === 25));
ok('the logo starts in the middle', same(B.logoPos({}), { x: 50, y: 50 }) && same(B.logoPos(null), { x: 50, y: 50 }));
ok('a saved logo position is used, kept to one decimal and to 0 to 100', same(B.logoPos({ homeLogoPos: { x: 20, y: 80 } }), { x: 20, y: 80 }) && same(B.logoPos({ homeLogoPos: { x: 33.333, y: 150 } }), { x: 33.3, y: 100 }) && same(B.logoPos({ homeLogoPos: { x: '30', y: ' 70 ' } }), { x: 30, y: 70 }));
ok('...rubbish is the middle, each value on its own', same(B.logoPos({ homeLogoPos: { x: 'left', y: 10 } }), { x: 50, y: 10 }) && same(B.logoPos({ homeLogoPos: 'abc' }), { x: 50, y: 50 }) && [null, '', 'x', true, NaN, Infinity, {}, [], '50%;background:url(x)'].every(v => same(B.logoPos({ homeLogoPos: { x: v, y: v } }), { x: 50, y: 50 })));
ok('the position of the logo does not change the position of the picture', same(B.pos({ homeLogoPos: { x: 10, y: 10 } }), { x: 50, y: 50 }) && same(B.logoPos({ homeHeaderPos: { x: 10, y: 10 } }), { x: 50, y: 50 }));
ok('a position in the middle adds no style; otherwise object-position', B.posCss({ x: 50, y: 50 }) === '' && B.posCss({ x: 0, y: 12.5 }) === 'object-position:0% 12.5%' && B.posCss({ x: 50, y: 80 }) === 'object-position:50% 80%');
// the header with a logo: two columns, and a height
ok('a logo on the left: its column first, then the picture', B.boxCss({ clubLogo: 'x', homeLogoSide: 'left', homeLogoShare: 30, homeHeaderHeight: 20 }) === 'grid-template-columns:minmax(0,30fr) minmax(0,70fr);aspect-ratio:100 / 20');
ok('a logo on the right: the picture first, then its column', B.boxCss({ clubLogo: 'x', homeLogoSide: 'right', homeLogoShare: 30, homeHeaderHeight: 20 }) === 'grid-template-columns:minmax(0,70fr) minmax(0,30fr);aspect-ratio:100 / 20');
ok('with a picture and an automatic height the picture decides the height (no aspect ratio)', B.boxCss({ clubLogo: 'x', homeLogoSide: 'left', homeHeader: 'data:p' }) === 'grid-template-columns:minmax(0,25fr) minmax(0,75fr)');
ok('with no picture and no height the header is 18 percent of the width', B.DEFAULT_HEIGHT === 18 && B.boxCss({ clubLogo: 'x', homeLogoSide: 'left' }) === 'grid-template-columns:minmax(0,25fr) minmax(0,75fr);aspect-ratio:100 / 18');
ok('a set height wins over the picture', B.boxCss({ clubLogo: 'x', homeLogoSide: 'left', homeHeader: 'data:p', homeHeaderHeight: 40 }).endsWith('aspect-ratio:100 / 40'));
ok('hostile values add nothing to the style of the header', /^grid-template-columns:minmax\(0,\d+fr\) minmax\(0,\d+fr\)(;aspect-ratio:100 \/ \d+)?$/.test(B.boxCss({ clubLogo: 'x', homeLogoSide: 'left;x:y', homeLogoShare: '5%;background:url(x)', homeHeaderHeight: '25;x:y' })) && !B.boxCss({ homeLogoSide: 'left', homeLogoShare: '20;x:y', homeHeaderHeight: 'url(x)' }).includes('url'));
// how much room the whole logo leaves
ok('a square logo in a wide box: room sideways only', same(B.logoRoom({ w: 200, h: 100 }, { w: 100, h: 100 }), { x: 100, y: 0 }));
ok('a wide logo in a tall box: room up-down only', same(B.logoRoom({ w: 100, h: 200 }, { w: 200, h: 100 }), { x: 0, y: 150 }));
ok('a logo of the same shape as its box fills it: no room', same(B.logoRoom({ w: 300, h: 100 }, { w: 600, h: 200 }), { x: 0, y: 0 }));
ok('the logo is scaled up to fill the box as well as down', same(B.logoRoom({ w: 400, h: 100 }, { w: 10, h: 10 }), { x: 300, y: 0 }));
ok('never both directions: a logo is scaled until one side touches', [[500, 500, 2000, 1000], [333, 111, 640, 480], [1000, 250, 1000, 1000], [117.5, 90, 500, 500], [90, 400, 31, 17]].every(([bw, bh, nw, nh]) => { const r = B.logoRoom({ w: bw, h: bh }, { w: nw, h: nh }); return r.x >= 0 && r.y >= 0 && (r.x < 1e-9 || r.y < 1e-9); }));
ok('unknown sizes have no room', [[{ w: 0, h: 0 }, { w: 5, h: 5 }], [{ w: 5, h: 5 }, { w: 0, h: 0 }], [{ w: -1, h: 5 }, { w: 5, h: 5 }], [{ w: NaN, h: 5 }, { w: 5, h: 5 }]].every(([a, b]) => same(B.logoRoom(a, b), { x: 0, y: 0 })));

if (fails) { console.log('\n' + fails + ' FAILED'); process.exit(1); }
console.log('ALL BANNER TESTS PASSED');
