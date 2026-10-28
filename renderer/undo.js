// Undo and redo for an editor. The editor says how to take a snapshot of what is being edited (get) and how to put a snapshot back (apply);
// this keeps the list of snapshots. A change is announced with touch(); a quiet moment after the last change (or commit()) makes it one step,
// so a whole drag or a typed word is one step. Pure: no screen, the timer can be replaced, so it can be tested.
(function (root) {
  const PIC = '$pic', BIG = 1000; // a text longer than this (a picture) is kept once, however many snapshots hold it

  function create(o) {
    const opt = o || {};
    const get = opt.get, apply = opt.apply;
    const limit = Math.max(1, Math.floor(opt.limit) || 100);       // most steps remembered
    const maxChars = Math.max(1000, Math.floor(opt.maxChars) || 20000000); // and the most text they may take together (the pictures are not counted: they are kept once)
    const wait = opt.wait === undefined ? 600 : opt.wait;           // quiet time that ends a step, in milliseconds
    const setT = opt.setTimer || ((f, ms) => setTimeout(f, ms)), clearT = opt.clearTimer || (t => clearTimeout(t));
    const note = () => { if (typeof opt.onchange === 'function') opt.onchange(); };

    // pictures: a snapshot holds a number instead of the picture's text. (They stay for as long as the editor is open.)
    const pics = [], picIds = new Map();
    const pack = state => JSON.stringify(state, (k, v) => {
      if (typeof v === 'string' && v.length > BIG) { let id = picIds.get(v); if (id === undefined) { id = pics.length; pics.push(v); picIds.set(v, id); } return { [PIC]: id }; }
      return v;
    });
    const unpack = text => JSON.parse(text, (k, v) => (v !== null && typeof v === 'object' && typeof v[PIC] === 'number' ? pics[v[PIC]] : v));

    let present = pack(get()), saved = opt.clean ? present : null;  // present: the state at the last step; saved: the state that is on disk
    let past = [], future = [], pending = false, timer = null, held = false;
    const clearTimer = () => { if (timer !== null) { clearT(timer); timer = null; } };
    const trim = () => {
      const size = () => past.reduce((n, s) => n + s.length, 0) + future.reduce((n, s) => n + s.length, 0) + present.length;
      while (past.length > 0 && (past.length > limit || size() > maxChars)) past.shift();
    };

    // something changed: it becomes a step after a quiet moment (not while the mouse is held, see hold)
    const touch = () => {
      const first = !pending; pending = true;
      clearTimer();
      if (!held && wait >= 0) timer = setT(() => { timer = null; commit(); }, wait);
      if (first) note();
    };
    // end the step now. Returns the snapshot that is the present state.
    const commit = () => {
      clearTimer();
      if (pending) {
        pending = false;
        const now = pack(get());
        if (now !== present) { past.push(present); present = now; future = []; trim(); }
        note();
      }
      return present;
    };
    const step = (back) => {
      commit();
      const from = back ? past : future, to = back ? future : past;
      if (!from.length) return false;
      to.push(present); present = from.pop();
      apply(unpack(present));
      clearTimer(); pending = false; // whatever the editor did while drawing again is not a change of the user
      note();
      return true;
    };
    const api = {
      touch, commit,
      undo: () => step(true), redo: () => step(false),
      canUndo: () => pending || past.length > 0,
      canRedo: () => !pending && future.length > 0,
      // while the mouse is held (a drag) the quiet moment does not end the step: letting go does
      hold: () => { held = true; clearTimer(); },
      release: () => { held = false; commit(); },
      // the state that was written to disk: after undoing back to it, nothing is unsaved any more
      markSaved: token => { saved = token === undefined ? commit() : token; },
      isClean: () => !pending && saved !== null && present === saved,
      stats: () => ({ undo: past.length, redo: future.length, chars: past.reduce((n, s) => n + s.length, 0) + future.reduce((n, s) => n + s.length, 0) + present.length, pictures: pics.length }),
      dispose: () => { clearTimer(); pending = false; past = []; future = []; }
    };
    return api;
  }

  const api = { create };
  root.Undo = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
