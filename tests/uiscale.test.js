// The size of the interface (uiscale.js): which sizes there are and how a saved value becomes a zoom factor.
const U = require('../renderer/uiscale.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };

ok('the standard size is 100%', U.DEFAULT === 100 && U.levelOf(undefined) === 100 && U.factorOf(undefined) === 1);
ok('there are six sizes from 100% to 200%, in this order', U.LEVELS.map(l => l[0]).join() === '100,110,125,150,175,200');
ok('every size has a name that shows its percentage', U.LEVELS.every(l => l[1].startsWith(l[0] + '%')));
ok('the standard and the largest size are named', /standard/.test(U.LEVELS[0][1]) && /very large/.test(U.LEVELS[5][1]));
ok('every size is kept as it is', U.LEVELS.every(l => U.levelOf(l[0]) === l[0]));
ok('a size saved as text is understood', U.levelOf('150') === 150 && U.levelOf(' 125 ') === 125);
ok('a size that is not offered becomes the standard', U.levelOf(137) === 100 && U.levelOf(99) === 100 && U.levelOf(250) === 100 && U.levelOf(0) === 100 && U.levelOf(-100) === 100);
ok('a size between two of the sizes is not one of them', U.levelOf(149.6) === 100 && U.levelOf(125.4) === 100 && U.levelOf('110.5') === 100);
ok('something that is not a number becomes the standard', U.levelOf('big') === 100 && U.levelOf(null) === 100 && U.levelOf(NaN) === 100 && U.levelOf({}) === 100 && U.levelOf('') === 100);
ok('the zoom factor is the percentage divided by 100', U.factorOf(110) === 1.1 && U.factorOf(125) === 1.25 && U.factorOf(150) === 1.5 && U.factorOf(175) === 1.75 && U.factorOf(200) === 2);
ok('the zoom factor is never outside what the window accepts (0.5 to 3)', U.LEVELS.every(l => U.factorOf(l[0]) >= 1 && U.factorOf(l[0]) <= 2));
ok('a wrong saved value gives no zoom at all (1)', U.factorOf('banana') === 1 && U.factorOf(7) === 1);
// (the start of the app is not a function to call from a test, so this one looks at the text of app.js: the second-screen window sets its zoom to 100% before it shows the Live Race pages, and the main window does not run that branch)
{ const app = require('fs').readFileSync(require('path').join(__dirname, '../renderer/app.js'), 'utf8'), from = app.indexOf("location.hash === '#live'"), mount = app.indexOf('LiveView.mount(view, { second: true })', from), branch = app.slice(from, mount);
  ok('the second-screen window keeps its own size: zoom 100% before the Live Race pages are shown', from > 0 && mount > from && /api\.setZoom\(1\)/.test(branch) && !/applyUiScale/.test(branch));
  ok('...and the main window applies the chosen size', /\n  applyUiScale\(\);/.test(app.slice(mount))); }

if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
console.log('ALL UISCALE TESTS PASSED');
