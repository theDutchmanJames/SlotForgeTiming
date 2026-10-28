// The frame of a widget: border shade, a border colour of your own, border thickness, no border, transparency (renderer/frame.js)
const F = require('../renderer/frame.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };

// the three settings, with what happens to rubbish
ok('no setting at all: the theme\'s own border, a quarter white, solid', F.mode({}) === '' && F.shade({}) === 37.5 && F.transparency({}) === 0);
ok('a border mode is one of: theme (empty), shade, custom (a colour of your own, 1.46.0), off; anything else is the theme', ['', 'shade', 'custom', 'off'].every(m => F.mode({ borderMode: m }) === m) && ['x', 5, null, true, 'SHADE', undefined].every(m => F.mode({ borderMode: m }) === ''));
ok('the shade runs from 0 to 100 in steps of half a percent', F.shade({ borderShade: 0 }) === 0 && F.shade({ borderShade: 100 }) === 100 && F.shade({ borderShade: 12.3 }) === 12.5 && F.shade({ borderShade: '70' }) === 70);
ok('a shade outside 0 to 100 is stopped at the edge; rubbish is the default', F.shade({ borderShade: -20 }) === 0 && F.shade({ borderShade: 250 }) === 100 && ['', ' ', 'x', null, NaN, true, {}, []].every(v => F.shade({ borderShade: v }) === 37.5));
ok('transparency is a whole number from 0 to 100, rubbish is solid', F.transparency({ transparency: 40.4 }) === 40 && F.transparency({ transparency: '25' }) === 25 && F.transparency({ transparency: -5 }) === 0 && F.transparency({ transparency: 900 }) === 100 && ['', 'x', null, NaN, true, {}].every(v => F.transparency({ transparency: v }) === 0));

// the border colour that goes with a background
ok('50 is the background colour itself', F.shadeOf('#336699', 50) === '#336699');
ok('0 is all white and 100 is all black', F.shadeOf('#336699', 0) === 'color-mix(in srgb, white 100%, #336699)' && F.shadeOf('#336699', 100) === 'color-mix(in srgb, black 100%, #336699)');
ok('37.5 is a quarter white added to the background', F.shadeOf('#336699', 37.5) === 'color-mix(in srgb, white 25%, #336699)');
ok('75 is half black added to the background', F.shadeOf('var(--panel)', 75) === 'color-mix(in srgb, black 50%, var(--panel))');

// the style of a widget
ok('a widget that never used these settings is left alone: only its background, no border colour of its own', JSON.stringify(F.style('#336699', {}, 'var(--line)')) === JSON.stringify({ background: '#336699', borderColor: '', backgroundClip: '', borderWidth: '' }) && F.css('#336699', {}, 'var(--line)') === 'background:#336699');
ok('without a colour the background is the theme panel', F.style('', {}, 'var(--line)').background === 'var(--panel)' && F.style(undefined, {}).background === 'var(--panel)');
ok('border "shade": the border is made from the background', F.style('#336699', { borderMode: 'shade' }, 'var(--line)').borderColor === 'color-mix(in srgb, white 25%, #336699)');
ok('...with the slider where it was put', F.style('#336699', { borderMode: 'shade', borderShade: 0 }).borderColor === 'color-mix(in srgb, white 100%, #336699)' && F.style('#336699', { borderMode: 'shade', borderShade: 100 }).borderColor === 'color-mix(in srgb, black 100%, #336699)' && F.style('#336699', { borderMode: 'shade', borderShade: 50 }).borderColor === '#336699');
ok('...and from the theme colour when the widget has no colour of its own', F.style('', { borderMode: 'shade' }).borderColor === 'color-mix(in srgb, white 25%, var(--panel))');
ok('a shade only counts when the mode is "shade"', F.style('#336699', { borderShade: 0 }, 'var(--line)').borderColor === '' && F.style('#336699', { borderMode: 'off', borderShade: 0 }).borderColor === 'transparent');
ok('border "off" draws no border but keeps the room it takes', F.style('#336699', { borderMode: 'off' }).borderColor === 'transparent' && F.css('#336699', { borderMode: 'off' }).includes('border-color:transparent'));
ok('transparency fades the background', F.style('#336699', { transparency: 40 }, 'var(--line)').background === 'color-mix(in srgb, #336699 60%, transparent)');
ok('...and the theme\'s border with it', F.style('#336699', { transparency: 40 }, 'var(--line)').borderColor === 'color-mix(in srgb, var(--line) 60%, transparent)');
ok('...and a shaded border with it', F.style('#336699', { borderMode: 'shade', transparency: 20 }).borderColor === 'color-mix(in srgb, color-mix(in srgb, white 25%, #336699) 80%, transparent)');
ok('100 is fully transparent', F.style('#336699', { transparency: 100 }).background === 'color-mix(in srgb, #336699 0%, transparent)');
ok('the background does not reach under a see-through border', F.style('#336699', { transparency: 10 }).backgroundClip === 'padding-box' && F.style('#336699', { borderMode: 'off' }).backgroundClip === 'padding-box');
ok('css text for an element', F.css('#336699', { borderMode: 'shade', transparency: 10 }, 'var(--muted)').startsWith('background:color-mix(in srgb, #336699 90%, transparent);border-color:') && F.css('#336699', { borderMode: 'shade' }).endsWith(';background-clip:padding-box'));
ok('a hostile colour is not written', F.style('red;background:url(x)', { borderMode: 'shade' }).background === 'var(--panel)' && F.style('url(x)', {}).background === 'var(--panel)' && F.style('#336699', { transparency: 10 }, 'x;y:url(z)').borderColor === 'color-mix(in srgb, var(--line) 90%, transparent)');
ok('colours the theme and the page use are accepted', ['rgb(10, 20, 30)', 'rgba(10,20,30,.5)', 'hsl(200 50% 40% / 50%)', 'gold', 'var(--accent)', '#abc'].every(c => F.style(c, {}).background === c));

// rounded corners
ok('a corner setting is 0 to 50 in half steps; empty or rubbish means nothing is set (null)', F.cornerPct(0) === 0 && F.cornerPct(50) === 50 && F.cornerPct('12.3') === 12.5 && F.cornerPct(-4) === 0 && F.cornerPct(300) === 50 && ['', ' ', 'x', null, undefined, NaN, true, {}, []].every(v => F.cornerPct(v) === null));
ok('nothing set on the widget or the layout: the style sheet\'s corners', F.corner({ w: 100, h: 100 }, {}, 1000) === '' && F.corner({ w: 100, h: 100 }, undefined, 1000) === '' && F.corner({ w: 100, h: 100, radius: '' }, { radius: '' }, 1000) === '');
ok('the layout\'s radius is a percent of the widget\'s shorter side, in cqw', F.corner({ w: 100, h: 100 }, { radius: 20 }, 1000) === '2cqw' && F.corner({ w: 300, h: 60 }, { radius: 20 }, 1000) === '1.2cqw' && F.corner({ w: 60, h: 300 }, { radius: 20 }, 1000) === '1.2cqw');
ok('50 is fully round: half the shorter side', F.corner({ w: 100, h: 100 }, { radius: 50 }, 1000) === '5cqw' && F.corner({ w: 300, h: 60 }, { radius: 50 }, 1000) === '3cqw');
ok('a widget\'s own radius wins, also 0 (square)', F.corner({ w: 100, h: 100, radius: 50 }, { radius: 10 }, 1000) === '5cqw' && F.corner({ w: 100, h: 100, radius: 0 }, { radius: 10 }, 1000) === '0cqw');
ok('an empty widget radius follows the layout', F.corner({ w: 100, h: 100, radius: '' }, { radius: 10 }, 1000) === '1cqw');
ok('a layout radius out of range is stopped at the edge', F.corner({ w: 100, h: 100 }, { radius: 400 }, 1000) === '5cqw');
ok('no known page width gives nothing', F.corner({ w: 100, h: 100, radius: 10 }, {}, 0) === '' && F.corner({ w: 100, h: 100, radius: 10 }, {}, undefined) === '');

// transparency for the whole layout, and a widget's own setting winning over it
ok('a widget\'s own transparency, empty meaning "follow the layout"', F.ownTransparency({ transparency: 40 }) === 40 && F.ownTransparency({ transparency: 0 }) === 0 && ['', undefined, null, 'x', NaN, true, {}].every(v => F.ownTransparency({ transparency: v }) === null) && F.ownTransparency({}) === null);
ok('the layout\'s setting is 0 to 100, rubbish is solid', F.layoutTransparency({ widgetTransparency: 30 }) === 30 && F.layoutTransparency({ widgetTransparency: '45' }) === 45 && F.layoutTransparency({ widgetTransparency: 500 }) === 100 && F.layoutTransparency({ widgetTransparency: -3 }) === 0 && [undefined, null, '', 'x', NaN, true, {}].every(v => F.layoutTransparency({ widgetTransparency: v }) === 0) && F.layoutTransparency(undefined) === 0);
ok('a widget without its own setting follows the layout', F.transparency({}, { widgetTransparency: 30 }) === 30 && F.transparency({ transparency: '' }, { widgetTransparency: 30 }) === 30);
ok('a widget\'s own setting wins, also solid (0)', F.transparency({ transparency: 70 }, { widgetTransparency: 30 }) === 70 && F.transparency({ transparency: 0 }, { widgetTransparency: 30 }) === 0);
ok('with no layout given, as before', F.transparency({}) === 0 && F.transparency({ transparency: 25 }) === 25);
ok('the style uses the layout\'s transparency on the background and the theme\'s border', F.style('#336699', {}, 'var(--line)', { widgetTransparency: 40 }).background === 'color-mix(in srgb, #336699 60%, transparent)' && F.style('#336699', {}, 'var(--line)', { widgetTransparency: 40 }).borderColor === 'color-mix(in srgb, var(--line) 60%, transparent)');
ok('...and a widget\'s own 0 keeps it solid in a see-through layout', F.style('#336699', { transparency: 0 }, 'var(--line)', { widgetTransparency: 40 }).borderColor === '' && F.css('#336699', { transparency: 0 }, 'var(--line)', { widgetTransparency: 40 }) === 'background:#336699');
ok('a layout setting of 0 changes nothing', F.css('#336699', {}, 'var(--line)', { widgetTransparency: 0 }) === 'background:#336699');
ok('what a layout keeps: its corners and its transparency, cleaned', JSON.stringify(F.pickLayout({ radius: 12.2, widgetTransparency: '35' })) === JSON.stringify({ radius: 12, widgetTransparency: 35 }) || JSON.stringify(F.pickLayout({ radius: 12.2, widgetTransparency: '35' })) === JSON.stringify({ radius: 12.5, widgetTransparency: 35 }));
ok('...for a layout without any: no corner setting, solid', JSON.stringify(F.pickLayout({})) === JSON.stringify({ radius: '', widgetTransparency: 0 }) && JSON.stringify(F.pickLayout(undefined)) === JSON.stringify({ radius: '', widgetTransparency: 0 }));

// 1.46.0: a border colour of your own, and the thickness of the border
ok('a colour of your own is #rgb or #rrggbb, kept as #rrggbb; anything else is the start colour (a quiet grey)', F.colorOf({ borderColor: '#FC0' }) === '#ffcc00' && F.colorOf({ borderColor: ' #AbCdEf ' }) === '#abcdef' && ['', 'red', 'rgb(1,2,3)', '#12', '#12345g', '#1234567', 'url(x)', '#fff;background:url(x)', null, undefined, 5, 'var(--accent)'].every(v => F.colorOf({ borderColor: v }) === F.COLOR_START) && F.COLOR_START === '#8f98a3');
ok('border "custom" draws the colour you picked', F.style('#336699', { borderMode: 'custom', borderColor: '#ffcc00' }, 'var(--line)').borderColor === '#ffcc00' && F.css('#336699', { borderMode: 'custom', borderColor: '#ffcc00' }).includes('border-color:#ffcc00'));
ok('...the start colour when none was picked yet', F.style('#336699', { borderMode: 'custom' }).borderColor === F.COLOR_START);
ok('...a colour only counts when the mode is "custom"', F.style('#336699', { borderColor: '#ffcc00' }, 'var(--line)').borderColor === '' && F.style('#336699', { borderMode: 'shade', borderColor: '#ffcc00' }).borderColor === 'color-mix(in srgb, white 25%, #336699)' && F.style('#336699', { borderMode: 'off', borderColor: '#ffcc00' }).borderColor === 'transparent');
ok('...it fades with the transparency like every other border', F.style('#336699', { borderMode: 'custom', borderColor: '#ffcc00', transparency: 40 }).borderColor === 'color-mix(in srgb, #ffcc00 60%, transparent)' && F.style('#336699', { borderMode: 'custom', borderColor: '#ffcc00' }, 'var(--line)', { widgetTransparency: 20 }).borderColor === 'color-mix(in srgb, #ffcc00 80%, transparent)');
ok('a hostile colour of your own is never written', F.css('#336699', { borderMode: 'custom', borderColor: 'red;background:url(x)' }).includes('border-color:' + F.COLOR_START) && !F.css('#336699', { borderMode: 'custom', borderColor: 'red;background:url(x)' }).includes('url'));
ok('the thickness is 0 to 40 layout units in half steps; empty or rubbish means nothing set (null)', F.widthOf({ borderWidth: 0 }) === 0 && F.widthOf({ borderWidth: 40 }) === 40 && F.widthOf({ borderWidth: '2.3' }) === 2.5 && F.widthOf({ borderWidth: -3 }) === 0 && F.widthOf({ borderWidth: 99 }) === 40 && ['', ' ', 'x', null, undefined, NaN, true, {}, []].every(v => F.widthOf({ borderWidth: v }) === null));
ok('a thickness is written as a share of the page width, in cqw, like the corners', F.style('#336699', { borderWidth: 4 }, 'var(--line)', {}, 1000).borderWidth === '0.4cqw' && F.style('#336699', { borderWidth: 20 }, 'var(--line)', {}, 1000).borderWidth === '2cqw' && F.style('#336699', { borderWidth: 0.5 }, 'var(--line)', {}, 1000).borderWidth === '0.05cqw' && F.style('#336699', { borderWidth: 4 }, 'var(--line)', {}, 500).borderWidth === '0.8cqw');
ok('...0 is a border of no thickness; nothing set leaves the style sheet\'s thin line', F.style('#336699', { borderWidth: 0 }, 'var(--line)', {}, 1000).borderWidth === '0cqw' && F.style('#336699', {}, 'var(--line)', {}, 1000).borderWidth === '' && F.style('#336699', { borderWidth: '' }).borderWidth === '');
ok('...the page is 1000 units wide when the caller does not say', F.style('#336699', { borderWidth: 4 }).borderWidth === '0.4cqw' && F.style('#336699', { borderWidth: 4 }, 'var(--line)', {}, 0).borderWidth === '0.4cqw');
ok('the thickness goes with every kind of border: the theme\'s, a shade, a colour of your own, and a see-through one', ['', 'shade', 'custom', 'off'].every(m => F.style('#336699', { borderMode: m, borderWidth: 4 }).borderWidth === '0.4cqw') && F.style('#336699', { transparency: 30, borderWidth: 4 }).borderWidth === '0.4cqw');
ok('css text carries the thickness, and only when it is set', F.css('#336699', { borderWidth: 4 }, 'var(--line)', {}, 1000) === 'background:#336699;border-width:0.4cqw' && F.css('#336699', { borderMode: 'custom', borderColor: '#ffcc00', borderWidth: 4, transparency: 10 }, 'var(--line)', {}, 1000).endsWith(';border-width:0.4cqw') && !F.css('#336699', { borderMode: 'custom' }).includes('border-width'));
ok('how solid a widget is, for the depth: 1 solid, 0 invisible, the layout\'s setting followed, its own setting winning', F.solidity({}) === 1 && F.solidity({ transparency: 40 }) === 0.6 && F.solidity({ transparency: 100 }) === 0 && F.solidity({}, { widgetTransparency: 25 }) === 0.75 && F.solidity({ transparency: 0 }, { widgetTransparency: 25 }) === 1 && F.solidity({ transparency: 10 }, { widgetTransparency: 25 }) === 0.9);
ok('a layout keeps no border colour or thickness of its own (they belong to each widget)', JSON.stringify(Object.keys(F.pickLayout({ borderWidth: 3, borderColor: '#fff', borderMode: 'custom' }))) === JSON.stringify(['radius', 'widgetTransparency']));

if (fails) { console.log('\n' + fails + ' FAILED'); process.exit(1); }
console.log('ALL FRAME TESTS PASSED');
