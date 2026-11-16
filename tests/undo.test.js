// Undo and redo: the list of steps of an editor (renderer/undo.js)
const U = require('../renderer/undo.js');
let fails = 0; const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };

// a stand-in for an editor: a state object, and a timer that only runs when the test says so
const make = (over = {}) => {
  const st = { v: { n: 0, list: [] } }, timers = [], applied = []; let changes = 0;
  const h = U.create({ get: () => st.v, apply: s => { st.v = s; applied.push(s); }, setTimer: f => { timers.push(f); return timers.length; }, clearTimer: id => { timers[id - 1] = null; }, onchange: () => { changes++; }, ...over });
  const quiet = () => { const fs = timers.splice(0).filter(Boolean); fs.forEach(f => f()); };
  return { st, h, quiet, applied, changes: () => changes, change: fn => { fn(st.v); h.touch(); } };
};

// the basics
{
  const e = make();
  ok('at the start there is nothing to undo or redo', !e.h.canUndo() && !e.h.canRedo() && e.h.undo() === false && e.h.redo() === false);
  e.change(v => { v.n = 1; }); e.h.commit(); e.change(v => { v.n = 2; }); e.h.commit();
  ok('each committed change is a step', e.h.stats().undo === 2 && e.h.canUndo() && !e.h.canRedo());
  ok('undo puts the state of one step back', e.h.undo() === true && e.st.v.n === 1 && e.h.canRedo());
  ok('...and again, back to the start', e.h.undo() === true && e.st.v.n === 0 && !e.h.canUndo() && e.h.undo() === false && e.st.v.n === 0);
  ok('redo goes forward again, step by step', e.h.redo() === true && e.st.v.n === 1 && e.h.redo() === true && e.st.v.n === 2 && e.h.redo() === false);
  e.h.undo(); e.change(v => { v.n = 9; }); e.h.commit();
  ok('a new change after an undo ends the redo list', e.h.canRedo() === false && e.h.redo() === false && e.st.v.n === 9);
  ok('undo then brings back the state before that new change', e.h.undo() && e.st.v.n === 1);
}

// a deleted thing comes back
{
  const e = make(); e.st.v.list = ['a', 'b', 'c']; const h2 = U.create({ get: () => e.st.v, apply: s => { e.st.v = s; }, setTimer: () => 0, clearTimer: () => {} });
  e.st.v.list = e.st.v.list.filter(x => x !== 'b'); h2.touch(); h2.commit();
  ok('a deleted item is restored, in its place', e.st.v.list.join() === 'a,c' && h2.undo() && e.st.v.list.join() === 'a,b,c' && h2.redo() && e.st.v.list.join() === 'a,c');
}

// a quiet moment ends a step: one drag or one typed word is one step
{
  const e = make();
  for (let i = 1; i <= 20; i++) e.change(v => { v.n = i; });
  ok('twenty small changes in a row are still waiting, not twenty steps', e.h.stats().undo === 0 && e.h.canUndo());
  e.quiet();
  ok('after the quiet moment they are one step', e.h.stats().undo === 1);
  e.h.undo(); ok('...and one undo takes them all back', e.st.v.n === 0);
  e.h.redo(); ok('...and one redo brings them all back', e.st.v.n === 20);
}
{
  const e = make();
  e.change(v => { v.n = 1; });
  ok('undo does not wait for the quiet moment: the change just made is what is undone', e.h.undo() === true && e.st.v.n === 0 && e.h.stats().redo === 1);
  e.h.redo(); ok('...and it can be redone', e.st.v.n === 1);
}
{
  const e = make();
  e.change(v => { v.n = 5; }); e.change(v => { v.n = 5; }); e.quiet();
  ok('a change that leaves everything as it was is no step', e.h.stats().undo === 1);
  const f = make(); f.h.touch(); f.quiet();
  ok('touching without changing anything is no step either', f.h.stats().undo === 0 && !f.h.canUndo());
}

// holding the mouse: the quiet moment does not cut a drag in two
{
  const e = make();
  e.h.hold(); e.change(v => { v.n = 1; }); e.quiet(); e.change(v => { v.n = 2; }); e.quiet();
  ok('while held, nothing becomes a step by itself', e.h.stats().undo === 0);
  e.h.release();
  ok('letting go ends the step: the whole drag is one', e.h.stats().undo === 1 && (e.h.undo(), e.st.v.n === 0));
}

// limits
{
  const e = make({ limit: 3 });
  for (let i = 1; i <= 6; i++) { e.change(v => { v.n = i; }); e.h.commit(); }
  ok('only the last steps are remembered (the oldest go first)', e.h.stats().undo === 3);
  let n = 0; while (e.h.undo()) n++;
  ok('...so three undos are possible, back to the state three steps ago', n === 3 && e.st.v.n === 3);
}
{
  const e = make({ maxChars: 3000 }); e.st.v.list = Array.from({ length: 40 }, (_, i) => 'item number ' + i);
  for (let i = 1; i <= 30; i++) { e.change(v => { v.n = i; }); e.h.commit(); }
  const s = e.h.stats();
  ok('the steps may not take more text than the limit, the oldest are dropped', s.chars <= 3000 + 1000 && s.undo < 30 && s.undo >= 1);
}

// pictures are kept once
{
  const pic = 'data:image/png;base64,' + 'A'.repeat(50000), other = 'data:image/png;base64,' + 'B'.repeat(50000);
  const e = make(); e.st.v.pic = pic;
  const h = U.create({ get: () => e.st.v, apply: s => { e.st.v = s; }, setTimer: () => 0, clearTimer: () => {} });
  for (let i = 1; i <= 40; i++) { e.st.v.n = i; h.touch(); h.commit(); }
  ok('a picture in forty steps is kept once: the steps stay small', h.stats().chars < 5000 && h.stats().pictures === 1 && h.stats().undo === 40);
  for (let i = 0; i < 40; i++) h.undo();
  ok('...and it comes back exactly', e.st.v.pic === pic && e.st.v.n === 0);
  e.st.v.pic = other; h.touch(); h.commit();
  ok('another picture is kept too, and undo brings the first back', h.stats().pictures === 2 && h.undo() && e.st.v.pic === pic && h.redo() && e.st.v.pic === other);
  const nested = { a: { b: ['x', pic, { c: other }] } }; const e2 = { v: nested };
  const h2 = U.create({ get: () => e2.v, apply: s => { e2.v = s; }, setTimer: () => 0, clearTimer: () => {} });
  e2.v.a.b[0] = 'y'; h2.touch(); h2.commit(); h2.undo();
  ok('pictures inside lists and objects come back in the same place', e2.v.a.b[0] === 'x' && e2.v.a.b[1] === pic && e2.v.a.b[2].c === other);
  ok('short texts are not touched', (() => { const e3 = { v: { t: 'hello', n: null, f: false } }; const h3 = U.create({ get: () => e3.v, apply: s => { e3.v = s; }, setTimer: () => 0, clearTimer: () => {} }); e3.v.t = 'bye'; h3.touch(); h3.commit(); h3.undo(); return e3.v.t === 'hello' && e3.v.n === null && e3.v.f === false; })());
}

// a snapshot does not change when the editor goes on changing the object
{
  const e = make(); e.change(v => { v.list.push('x'); }); e.h.commit(); e.st.v.list.push('y'); // (changed without touch: not a step, not in any snapshot)
  e.h.undo(); ok('steps are copies: later changes to the object do not alter them', e.st.v.list.length === 0);
}

// unsaved changes
{
  const e = make({ clean: true });
  ok('an item that was opened from disk starts clean', e.h.isClean());
  e.change(v => { v.n = 1; }); ok('a change makes it not clean (even before the step ends)', !e.h.isClean());
  e.h.commit(); e.change(v => { v.n = 2; }); e.h.commit();
  e.h.undo(); e.h.undo(); ok('undoing back to what is on disk makes it clean again', e.h.isClean());
  e.h.redo(); ok('...and redoing is not clean', !e.h.isClean());
  const token = e.h.commit(); e.change(v => { v.n = 3; }); e.h.markSaved(token); e.h.commit();
  ok('what is saved is the state of the token, not what came later', !e.h.isClean() && (e.h.undo(), e.h.isClean()));
  const n = make(); ok('a new item is not clean until it is saved', !n.h.isClean()); n.h.markSaved(); ok('...saving makes it clean', n.h.isClean());
  n.change(v => { v.n = 4; }); n.h.markSaved(); ok('markSaved without a token takes the state as it is now', n.h.isClean());
}

// signals for the buttons
{
  const e = make(); const c0 = e.changes();
  e.change(v => { v.n = 1; });
  ok('the first change of a step tells the editor (the Undo button can light up), the next ones do not', e.changes() === c0 + 1 && (e.change(v => { v.n = 2; }), e.changes() === c0 + 1));
  e.quiet(); const c1 = e.changes(); e.h.undo();
  ok('ending a step and undoing tell the editor too', c1 > c0 + 1 && e.changes() > c1);
  ok('redo is not offered while a new change is waiting', (e.h.redo(), e.h.undo(), e.change(v => { v.n = 7; }), e.h.canRedo() === false && e.h.canUndo()));
}

// the timer
{
  const timers = []; let cleared = 0; const st = { v: { n: 0 } };
  const h = U.create({ get: () => st.v, apply: s => { st.v = s; }, setTimer: (f, ms) => { timers.push([f, ms]); return timers.length; }, clearTimer: () => { cleared++; }, wait: 450 });
  st.v.n = 1; h.touch(); st.v.n = 2; h.touch();
  ok('every change restarts the quiet moment (it is the time since the last change)', timers.length === 2 && cleared >= 1 && timers.every(t => t[1] === 450));
  h.dispose(); ok('dispose stops the timer and forgets the steps', cleared >= 2 && !h.canUndo() && h.stats().undo === 0);
}

// the real timer is the default
(async () => {
  const st = { v: { n: 0 } }, h = U.create({ get: () => st.v, apply: s => { st.v = s; }, wait: 15 });
  st.v.n = 1; h.touch(); await new Promise(r => setTimeout(r, 60));
  ok('with the real timer a step ends by itself after the quiet moment', h.stats().undo === 1 && h.undo() && st.v.n === 0);
  const g = U.create({ get: () => st.v, apply: s => { st.v = s; }, wait: 15 });
  st.v.n = 5; g.touch(); g.dispose(); await new Promise(r => setTimeout(r, 60));
  ok('...and a disposed one does nothing any more', g.stats().undo === 0 && !g.canUndo() && st.v.n === 5);
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})();
