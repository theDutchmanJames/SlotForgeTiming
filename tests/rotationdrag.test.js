// 1.16.0: dragging in the Rotation Editor (renderer/rotationdrag.js) on its own: what a drop does (the same rules as the buttons), what can be picked up and what a drop can land on,
// and the pointer events: a small move is a click, the ghost, the lights, the marks, Esc, a cancelled drag, the click after a drag and the scrolling near the edge of the window.
// The editor page uses it as the screen tests show (rotationscreen); this one checks the rules with stand-in elements.
const vm = require('vm'), fs = require('fs'), path = require('path');
let fails = 0;
const say = (m, c) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const Rot = require('../renderer/rotation.js');

// ---- a stand-in page ----
const timers = [], later = [], ghosts = [], keyFns = new Set(), scrolls = [];
const document = { createElement: () => { const g = { className: '', textContent: '', style: { props: {}, setProperty(k, v) { this.props[k] = v; } }, removed: false, remove() { this.removed = true; } }; ghosts.push(g); return g; },
  addEventListener: (t, f) => { if (t === 'keydown') keyFns.add(f); }, removeEventListener: (t, f) => { if (t === 'keydown') keyFns.delete(f); }, elementFromPoint: () => null };
const win = { innerHeight: 800, scrollBy: (x, y) => scrolls.push(y) };
const ctx = vm.createContext({ Rot, document, window: win, console, Math, Number, String, Object, Array, Set,
  setInterval: f => { timers.push(f); return timers.length; }, clearInterval: id => { timers[id - 1] = null; }, setTimeout: f => { later.push(f); return later.length; } });
const RotDrag = vm.runInContext(fs.readFileSync(path.join(__dirname, '../renderer/rotationdrag.js'), 'utf8') + '\n;RotDrag', ctx);
const flush = () => { while (later.length) later.shift()(); };
const tick = () => timers.forEach(f => f && f());

// an element: dataset, a place in the tree (parent), the classes it was given; closest() finds the first that has what the selector asks for
const el = (ds = {}, parent = null, id = '') => { const e = { dataset: ds, parent, id, classes: new Set(), textContent: ds.text || '', captured: null,
  classList: { add: c => e.classes.add(c), remove: c => e.classes.delete(c) }, setPointerCapture: x => { e.captured = x; }, releasePointerCapture: x => { if (e.captured === x) e.captured = null; },
  closest: sel => { for (let n = e; n; n = n.parent) if (sel.split(',').some(p => { p = p.trim(); return p.startsWith('#') ? n.id === p.slice(1) : p.startsWith('[data-') ? n.dataset[p.slice(6, -1)] !== undefined : false; })) return n; return null; } }; return e; };
const rec = () => Rot.clean({ name: 'T', participants: 6, lanes: 3, heats: [
  { label: 'A', places: [0, 1, 2].map((p, lane) => ({ p, lane })) }, { label: 'B', locked: false, places: [3, 4].map((p, lane) => ({ p, lane })) }, { label: 'C', places: [5, 0].map((p, lane) => ({ p, lane })) }] });
const grid = r => r.heats.map(h => h.places.slice().sort((a, b) => a.lane - b.lane).map(e => e.p + '@' + e.lane).join(' '));
const err = r => (r && r.error) || '';

// ---- what a drop does ----
{ const d = rec();
  say('a participant onto an empty place: the participant stands there', grid(RotDrag.plan(d, { kind: 'chip', p: 5 }, { kind: 'cell', heat: 1, lane: 2 }).rec)[1] === '3@0 4@1 5@2');
  say('...onto a place with somebody: that one leaves the heat', grid(RotDrag.plan(d, { kind: 'chip', p: 5 }, { kind: 'cell', heat: 0, lane: 1 }).rec)[0] === '0@0 5@1 2@2');
  say('...a participant who is in the heat already moves to the new lane (nobody is in a heat twice)', grid(RotDrag.plan(d, { kind: 'chip', p: 0 }, { kind: 'cell', heat: 0, lane: 2 }).rec)[0] === '1@1 0@2');
  say('...onto the place where the participant stands already: nothing changes', RotDrag.plan(d, { kind: 'chip', p: 0 }, { kind: 'cell', heat: 0, lane: 0 }) === null);
  say('a place onto another place: the two swap', grid(RotDrag.plan(d, { kind: 'cell', heat: 0, lane: 0 }, { kind: 'cell', heat: 1, lane: 1 }).rec).slice(0, 2).join('|') === '4@0 1@1 2@2|3@0 0@1');
  say('...onto an empty place: the participant moves there', grid(RotDrag.plan(d, { kind: 'cell', heat: 0, lane: 0 }, { kind: 'cell', heat: 1, lane: 2 }).rec).slice(0, 2).join('|') === '1@1 2@2|3@0 4@1 0@2');
  say('...onto itself: nothing changes', RotDrag.plan(d, { kind: 'cell', heat: 0, lane: 0 }, { kind: 'cell', heat: 0, lane: 0 }) === null);
  say('...a swap that would put somebody in a heat twice is refused in words', err(RotDrag.plan(d, { kind: 'cell', heat: 0, lane: 0 }, { kind: 'cell', heat: 2, lane: 0 })) === 'That would put a participant in the same heat twice.');
  say('a place back onto the participants: the place is emptied', grid(RotDrag.plan(d, { kind: 'cell', heat: 0, lane: 1 }, { kind: 'tray' }).rec)[0] === '0@0 2@2');
  say('...an empty place onto the participants: nothing to do', RotDrag.plan(d, { kind: 'cell', heat: 1, lane: 2 }, { kind: 'tray' }) === null);
  say('a heat onto another heat: it moves there', RotDrag.plan(d, { kind: 'heat', heat: 0 }, { kind: 'heat', heat: 2 }).rec.heats.map(h => h.label).join('') === 'BCA' && RotDrag.plan(d, { kind: 'heat', heat: 2 }, { kind: 'heat', heat: 0 }).rec.heats.map(h => h.label).join('') === 'CAB');
  say('...onto itself: nothing changes', RotDrag.plan(d, { kind: 'heat', heat: 1 }, { kind: 'heat', heat: 1 }) === null);
  say('what makes no sense does nothing: a participant onto the participants or a heat, a heat onto a place, nothing, or onto nothing', [[{ kind: 'chip', p: 1 }, { kind: 'tray' }], [{ kind: 'chip', p: 1 }, { kind: 'heat', heat: 0 }], [{ kind: 'heat', heat: 0 }, { kind: 'cell', heat: 1, lane: 0 }], [{ kind: 'heat', heat: 0 }, { kind: 'tray' }], [null, { kind: 'tray' }], [{ kind: 'chip', p: 1 }, null]].every(([a, b]) => RotDrag.plan(d, a, b) === null));
  const lk = rec(); lk.heats[1].locked = true;
  say('a locked heat cannot be changed: a drop on it, or from it, gives the same sentence as the buttons', /locked/.test(err(RotDrag.plan(lk, { kind: 'chip', p: 5 }, { kind: 'cell', heat: 1, lane: 2 }))) && /locked/.test(err(RotDrag.plan(lk, { kind: 'cell', heat: 0, lane: 0 }, { kind: 'cell', heat: 1, lane: 0 }))) && /locked/.test(err(RotDrag.plan(lk, { kind: 'cell', heat: 1, lane: 0 }, { kind: 'tray' }))));
  say('...a heat does not move past a locked heat, or onto it', /locked/.test(err(RotDrag.plan(lk, { kind: 'heat', heat: 0 }, { kind: 'heat', heat: 2 }))) && /locked/.test(err(RotDrag.plan(lk, { kind: 'heat', heat: 1 }, { kind: 'heat', heat: 0 }))));
  say('plan never changes the rotation it is given', JSON.stringify(d) === JSON.stringify(rec())); }

// ---- what can be picked up, and what a drop can land on ----
{ const chip = el({ pp: '4', short: 'P5', color: '#a46bff' }), cellFull = el({ cell: '1:2', p: '3', short: 'P4', color: '#f2b705' }), cellEmpty = el({ cell: '0:1' }), cellLocked = el({ cell: '2:0', p: '5', lk: '1' });
  const grip = el({ hh: '2' }), gripLocked = el({ hh: '1', lk: '1' }), inner = el({}, chip), other = el({ gm: '0:1' });
  const s = x => RotDrag.sourceOf(x);
  say('a participant can be picked up (also by what is inside it), with its number, its text and its colour', s(chip).from.kind === 'chip' && s(chip).from.p === 4 && s(chip).text === 'P5' && s(chip).color === '#a46bff' && s(inner).el === chip);
  say('a place with a participant can be picked up: the heat and the lane, the participant', s(cellFull).from.kind === 'cell' && s(cellFull).from.heat === 1 && s(cellFull).from.lane === 2 && s(cellFull).p === 3 && s(cellFull).text === 'P4');
  say('an empty place, a place of a locked heat, the chip of a group and nothing cannot be picked up', s(cellEmpty) === null && s(cellLocked) === null && s(other) === null && s(null) === null && s({}) === null);
  say('a heat can be picked up by its grip, unless it is locked', s(grip).from.kind === 'heat' && s(grip).from.heat === 2 && s(grip).text === 'Heat 3' && s(gripLocked) === null);
  const row = el({ hrow: '1' }), rowCell = el({ cell: '1:0' }, row), pool = el({}, null, 'ro-pool'), poolChip = el({ pp: '1' }, pool), stray = el({});
  const t = (from, x) => RotDrag.targetOf(from, x);
  say('a participant can land on a place (not on the participants, not on a row)', t({ kind: 'chip', p: 1 }, rowCell).to.heat === 1 && t({ kind: 'chip', p: 1 }, rowCell).to.lane === 0 && t({ kind: 'chip', p: 1 }, poolChip) === null && t({ kind: 'chip', p: 1 }, row) === null);
  say('a place can land on a place, or on the row of participants', t({ kind: 'cell', heat: 0, lane: 0 }, rowCell).el === rowCell && t({ kind: 'cell', heat: 0, lane: 0 }, poolChip).to.kind === 'tray' && t({ kind: 'cell', heat: 0, lane: 0 }, pool).el === pool);
  say('a heat can land on a row (also on a place inside it), and nowhere else', t({ kind: 'heat', heat: 0 }, row).to.heat === 1 && t({ kind: 'heat', heat: 0 }, rowCell).to.heat === 1 && t({ kind: 'heat', heat: 0 }, pool) === null);
  say('somewhere else, or nowhere (outside the window), is no target', t({ kind: 'chip', p: 1 }, stray) === null && t({ kind: 'chip', p: 1 }, null) === null); }

// ---- the pointer ----
{ const d = rec();
  const cA = el({ cell: '0:0', p: '0', short: 'P1', color: '#4c9aff' }), cB = el({ cell: '1:1', p: '4', short: 'P5', color: '#a46bff' }), cC = el({ cell: '2:1', p: '0', short: 'P1', color: '#4c9aff' }), cE = el({ cell: '1:2' }), cL = el({ cell: '0:2', p: '2' });
  const pool = el({}, null, 'ro-pool'), chip0 = el({ pp: '0', short: 'P1', color: '#4c9aff' }, pool), chip5 = el({ pp: '5', short: 'P6', color: '#ff6fb5' }, pool);
  const table = el({}); table.classes = new Set();
  const rows = [0, 1, 2].map(i => el({ hrow: String(i) })), grips = [0, 1, 2].map(i => el({ hh: String(i) }, rows[i]));
  const box = { querySelector: sel => (sel === '.rogrid' ? table : null), querySelectorAll: sel => (sel === '[data-cell]' ? [cA, cB, cC, cE, cL] : []), appended: [], appendChild(g) { this.appended.push(g); } };
  let under = null; const drops = [], ends = [], found = [];
  const drag = RotDrag.attach(box, { d: () => d, find: (x, y) => { found.push([x, y]); return under; }, drop: (from, to) => { drops.push([from, to]); const r = RotDrag.plan(d, from, to); return !!r && !r.error; }, end: changed => ends.push(changed) });
  const ev = (x, y, over = {}) => ({ pointerId: 1, button: 0, clientX: x, clientY: y, target: null, ...over });
  const down = (target, x = 100, y = 100, over = {}) => box.onpointerdown(ev(x, y, { target, ...over })), move = (x, y, over = {}) => box.onpointermove(ev(x, y, over)), up = (x, y, over = {}) => box.onpointerup(ev(x, y, over));
  const reset = () => { drops.length = 0; ends.length = 0; ghosts.length = 0; box.appended.length = 0; scrolls.length = 0; flush(); };

  // a click: the pointer hardly moves
  down(chip0); move(102, 103); up(102, 103);
  say('a small move is a click: no ghost, no drop, no mark, and the click that follows is let through', drops.length === 0 && ends.length === 0 && ghosts.length === 0 && !chip0.classes.has('dragging') && !table.classes.has('hl') && drag.suppressed() === false);
  say('...the chip was held by the pointer while it was down, and let go', chip0.captured === null);

  // a drag of a participant onto an empty place
  reset(); down(chip0, 100, 100); say('a pointer that goes down on a participant holds it (pointer capture)', chip0.captured === 1);
  under = cE; move(160, 180);
  say('past a few pixels it is a drag: a ghost with the text and the colour of the participant follows the pointer', ghosts.length === 1 && box.appended.length === 1 && ghosts[0].textContent === 'P1' && ghosts[0].style.props['--pc'] === '#4c9aff' && ghosts[0].style.left === '160px' && ghosts[0].style.top === '180px' && ghosts[0].className === 'rodrag');
  say('...the participant is faded, the places of that participant are marked and the others dimmed', chip0.classes.has('dragging') && table.classes.has('hl') && cA.classes.has('mine') && cC.classes.has('mine') && !cB.classes.has('mine') && !cE.classes.has('mine'));
  say('...the place under the pointer is lit as a place where it can land', cE.classes.has('dropok') && !cE.classes.has('dropno') && found.length > 0);
  under = cB; move(200, 200);
  say('...moving on puts the light out on the old place and on the new place', !cE.classes.has('dropok') && cB.classes.has('dropok') && ghosts[0].style.left === '200px');
  under = null; move(300, 300);
  say('...a pointer over nothing lights nothing', !cB.classes.has('dropok') && !cB.classes.has('dropno'));
  under = cE; move(160, 180); up(160, 180);
  say('letting go over a place does the drop (the participant, the place) and tells the page it changed', drops.length === 1 && drops[0][0].kind === 'chip' && drops[0][0].p === 0 && drops[0][1].kind === 'cell' && drops[0][1].heat === 1 && drops[0][1].lane === 2 && ends.join() === 'true');
  say('...the ghost, the lights and the marks are gone, the participant is back, the pointer is let go', ghosts[0].removed && !chip0.classes.has('dragging') && !table.classes.has('hl') && !cA.classes.has('mine') && !cC.classes.has('mine') && !cE.classes.has('dropok') && chip0.captured === null);
  say('...the click that comes after the drag is held back, once', drag.suppressed() === true && (flush(), drag.suppressed() === false));

  // a heat that is locked: the place says no
  reset(); const lk = rec(); lk.heats[0].locked = true; const keep = d.heats; d.heats = lk.heats;
  down(chip5); under = cA; move(200, 100);
  say('a place where the drop cannot be done (a locked heat) is lit as "no"', cA.classes.has('dropno') && !cA.classes.has('dropok'));
  up(200, 100);
  say('...a drop there is tried, refused by the rules, and the page is told nothing changed', drops.length === 1 && ends.join() === 'false'); d.heats = keep; flush();

  // a place onto a place, a place onto the participants
  reset(); down(cA, 50, 50); under = cB; move(90, 90); say('a place with a participant can be dragged too (its ghost is the participant)', ghosts.length === 1 && ghosts[0].textContent === 'P1' && cA.classes.has('dragging') && cC.classes.has('mine'));
  up(90, 90); say('...onto a place it is a drop from a place', drops.length === 1 && drops[0][0].kind === 'cell' && drops[0][0].heat === 0 && drops[0][1].kind === 'cell' && drops[0][1].heat === 1 && ends.join() === 'true'); flush();
  reset(); down(cA, 50, 50); under = pool; move(90, 90); say('...the participants lights up as the place to empty a place', pool.classes.has('dropok')); up(90, 90);
  say('...and the drop is "to the participants"', drops.length === 1 && drops[0][1].kind === 'tray'); flush();
  reset(); down(chip5, 50, 50); under = pool; move(90, 90); say('a participant dragged over the participants lights nothing', !pool.classes.has('dropok')); up(90, 90);
  say('...and the drop is not done', drops.length === 0 && ends.join() === 'false'); flush();

  // a heat by its grip
  reset(); down(grips[0], 50, 50); under = rows[2]; move(60, 120);
  say('a heat is dragged by its grip: the ghost says which heat, and the row under the pointer is lit', ghosts[0].textContent === 'Heat 1' && rows[2].classes.has('dropok') && !table.classes.has('hl') && grips[0].classes.has('dragging'));
  up(60, 120); say('...the drop is "heat 1 to heat 3"', drops.length === 1 && drops[0][0].kind === 'heat' && drops[0][0].heat === 0 && drops[0][1].heat === 2); flush();

  // Esc, cancel, another pointer, the right button, a drop on nothing
  reset(); down(chip0); under = cE; move(160, 180); say('while a drag goes on, Esc listens', keyFns.size === 1);
  [...keyFns][0]({ key: 'Escape' });
  say('Esc lets go: the ghost, the lights and the marks go, nothing is dropped, the page is told', ghosts[0].removed && !cE.classes.has('dropok') && !table.classes.has('hl') && drops.length === 0 && ends.join() === 'false' && keyFns.size === 0);
  move(300, 300); up(300, 300);
  say('...the rest of the move and the pointer going up do nothing, and the click after it is held back', drops.length === 0 && ends.length === 1 && ghosts.length === 1 && drag.suppressed() === true); flush();
  reset(); down(chip0); under = cE; move(160, 180); box.onpointercancel(ev(160, 180));
  say('a drag that is cancelled by the system (the pointer is taken away) is dropped nowhere', drops.length === 0 && ends.join() === 'false' && ghosts[0].removed && keyFns.size === 0); flush();
  reset(); down(chip0); box.onpointermove(ev(300, 300, { pointerId: 7 })); box.onpointerup(ev(300, 300, { pointerId: 7 }));
  say('another pointer (a second finger) does not move or end the drag', ghosts.length === 0 && drops.length === 0); up(100, 100); flush();
  reset(); down(chip0, 100, 100, { button: 2 }); move(300, 300);
  say('the right button does not drag', ghosts.length === 0 && drops.length === 0); up(300, 300); flush();
  reset(); down(chip0); down(chip5, 100, 100); under = cE; move(160, 180); up(160, 180);
  say('a second pointer going down while one is held is ignored: the first drag goes on with its own participant', drops.length === 1 && drops[0][0].p === 0); flush();
  reset(); down(chip0); under = el({}); move(160, 180); up(160, 180);
  say('a drop on something that is no place does nothing, and the page is told (it draws itself again)', drops.length === 0 && ends.join() === 'false'); flush();
  reset(); down(cE, 10, 10); move(80, 80); up(80, 80);
  say('an empty place cannot be picked up', ghosts.length === 0 && drops.length === 0 && ends.length === 0);

  // near the edge of the window the page scrolls
  reset(); win.innerHeight = 800; down(chip0, 100, 400); under = cE; move(100, 30); tick();
  say('with the pointer near the top of the window the page scrolls up (more, the nearer to the edge)', scrolls.length === 1 && scrolls[0] < 0);
  move(100, 5); scrolls.length = 0; tick(); const nearTop = scrolls[0];
  move(100, 60); scrolls.length = 0; tick(); const farTop = scrolls[0];
  say('...the nearer the edge the faster', nearTop < farTop && farTop < 0);
  move(100, 790); scrolls.length = 0; tick();
  say('...and near the bottom it scrolls down', scrolls.length === 1 && scrolls[0] > 0);
  scrolls.length = 0; move(100, 400); tick();
  say('...in the middle of the window it does not scroll', scrolls.length === 0);
  up(100, 400); scrolls.length = 0; tick();
  say('...and when the drag is over the timer is gone', scrolls.length === 0 && timers.every(t => t === null)); flush();

  say('the click method is not touched: there is no handler for click in this file', !/onclick/.test(fs.readFileSync(path.join(__dirname, '../renderer/rotationdrag.js'), 'utf8').replace(/\/\/.*$/gm, ''))); }

console.log(fails ? fails + ' ROTATION DRAG TESTS FAILED' : 'ALL ROTATION DRAG TESTS PASSED'); process.exit(fails ? 1 : 0);
