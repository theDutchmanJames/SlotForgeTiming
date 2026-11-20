'use strict';
// 2.4.0 review: the race system editors and the other pages (championships, rotations, audio sets, Multi-Class, Virtual Rivals, Import and Export,
// Calculations, Paddock Pit Lane): the fixes of the review, one test each.
const test = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const { code, has, root } = require('./source.cjs');

// championshipui.js is a classic script: its functions, in a context of their own
const champUi = () => {
  const ctx = vm.createContext({ console });
  vm.runInContext(fs.readFileSync(path.join(root, 'renderer/championshipui.js'), 'utf8') + '\n;this.champKeepSaved = champKeepSaved;', ctx);
  return ctx;
};

test('F1: a championship saved from the editor keeps the adjustments and the skipped sessions saved meanwhile', () => {
  const { champKeepSaved } = champUi();
  const draft = {
    name: 'C',
    rounds: [
      {
        id: 'r1',
        sessions: [
          { id: 's1', setup: 'p' },
          { id: 's2', setup: 'q' },
          { id: 's3', setup: 'new' }
        ]
      }
    ],
    adjustments: [{ id: 'old', driver: 'd', points: -5, reason: 'stale' }]
  };
  const saved = {
    rounds: [
      {
        id: 'r1',
        sessions: [
          { id: 's1', setup: 'p', skipped: true },
          { id: 's2', setup: 'q' },
          { id: 's3', setup: 'was', skipped: true }
        ]
      }
    ],
    adjustments: [{ id: 'a2', driver: 'd', points: 3, reason: 'Correction' }]
  };
  const out = champKeepSaved(draft, saved);
  assert.deepEqual(
    [...out.adjustments.map(a => a.id)], // (an array of the other context, made one of this)
    ['a2'],
    'the adjustments as they are stored now'
  );
  assert.equal(out.rounds[0].sessions[0].skipped, true, 'skipped on Home while the editor was open');
  assert.equal(out.rounds[0].sessions[1].skipped, undefined);
  assert.equal(out.rounds[0].sessions[2].skipped, undefined, 'the editor chose another race setup: not skipped any more');
  assert.equal(champKeepSaved(draft, null), draft, 'nothing stored: the draft as it is');
  const none = champKeepSaved(draft, { rounds: [] });
  assert.equal(none.adjustments, undefined, 'all adjustments were removed in the standings');
  const ui = code('renderer/championshipui.js');
  assert(
    has(ui, "data = champKeepSaved(data, await Promise.resolve().then(() => api.getRecord('championships', chEd.id)).catch(() => null));")
  );
});

test('F2: Duplicate leaves out the adjustments and the skipped sessions of the original', () => {
  const ui = code('renderer/championshipui.js');
  assert(has(ui, 'delete x.adjustments;'));
  assert(has(ui, 'delete s.id; delete s.skipped;'));
});

test('F3: Fix it goes on after a reconnect that worked', () => {
  const pl = code('renderer/pitlaneview.js');
  assert(
    has(
      pl,
      "r.how === 'found' ? 'Found the Dealership on a new address and connected.' : 'Connected to the Dealership again.' ); return r;"
    )
  );
});

test('F4: a sound file or a recorded name goes to the sentence and the set it was chosen for', () => {
  const ae = code('renderer/audioedit.js');
  assert(has(ae, 'line = ref(t.dataset.file)'));
  assert(has(ae, 'if (!audEd || audEd.draft !== d || !line || !(d.calls[id] && d.calls[id].lines.includes(line))) return;'));
  assert(has(ae, 'line.file = String(rd.result);'));
  const bv = code('renderer/audioboothview.js');
  assert(has(bv, 'booth = audBooth;'));
  assert(has(bv, "const same = () => audBooth === booth && typeof audEd !== 'undefined' && audEd && audEd.draft === booth.d;"));
  assert(has(bv, "if (audBooth !== b || typeof audEd === 'undefined' || !audEd || audEd.draft !== b.d) return;"));
});

test('F5: Multi-Class: a points field drawn again or taken away no longer blocks Save', () => {
  const mc = code('renderer/multiclassui.js');
  assert(has(mc, 'ed.badPoints = !!box.querySelector(\'#mc-points [data-invalid="yes"]\');'));
  const r = mc.indexOf('function refresh()'),
    at = mc.indexOf("ed.badPoints = !!box.querySelector('#mc-points");
  assert(
    r > 0 && at > r && at < mc.indexOf("q('#mc-error').textContent = errors.join"),
    'worked out in refresh, before the errors are said'
  );
});

test('F6: the replay speed can be typed; it is clamped when the box is left', () => {
  const vr = code('renderer/virtualrivalui.js');
  assert(has(vr, "if (e.target.type === 'number' && !(d.speed >= 80 && d.speed <= 120)) d.speed = before;"));
  assert(has(vr, "if (e.target.dataset && e.target.dataset.vr === 'speed') {"));
  assert(has(vr, 'd.speed = Math.min(120, Math.max(80, Number(e.target.value) || 100));'));
});

test('F7: another recording with the same driver chosen already copies its laps', () => {
  assert(has(code('renderer/virtualrivalui.js'), "if (q('#vr-person').value) loadSource();"));
});

test('F8: the Dealership card counts the cars of the catalogue', () => {
  assert(has(code('renderer/pitlaneview.js'), 'dealerCars = ((await api.paddockCatalogue(false).catch(() => null))?.cars || []).length;'));
});

test('F9: an import row that is not shown and already here is skipped unless chosen, and the hidden rows are counted', () => {
  const tr = code('renderer/transferui.js');
  assert(has(tr, "(m.match ? (unseen.has(m) ? 'skip' : m.how === 'id' && m.e !== 'sessions' ? 'replace' : 'copy') : 'copy')"));
  assert(has(tr, '.slice(0, TR_SHOWN)'));
  assert(has(tr, 'more not shown:'));
});

test('F10: picking a backup of the list forgets the file chosen before', () => {
  const tr = code('renderer/transferui.js');
  const at = tr.indexOf('const pick = await api.backupPick(d.bvRestore);');
  assert(at > 0);
  assert(has(tr.slice(at, at + 600), 'if (trState.bk) { trState.bk = null;'));
});

test('F11: Back stops the sample race', () => {
  assert(has(code('renderer/audioedit.js'), "if (typeof audSample !== 'undefined' && audSample) audSample.stop();"));
});

test('F12: the driver defaults of a new class follow it to its saved id', () => {
  assert(has(code('renderer/multiclassui.js'), 'd.driverClasses.forEach(a => { if (a.classId === old) a.classId = c.id;'));
});

test('F13: a number of heats that is not a whole number in range is said', () => {
  const ro = code('renderer/rotationui.js');
  assert(has(ro, "if (gen.plan === 'manual' && !whole(gen.heats, Rot.LIMITS.maxHeats))"));
  assert(has(ro, "if (gen.plan === 'perdriver' && !whole(gen.each, 50))"));
  const whole = (v, hi) => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= hi && String(v).trim() !== '';
  assert.deepEqual(
    ['-3', '0', '', 'abc', '2.5', '999', '4', 4].map(v => whole(v, 200)),
    [false, false, false, false, false, false, true, true]
  );
});

test('F14: Calculations: a form saved with its own button is the new place of Undo', () => {
  const c = code('renderer/calculationsui.js');
  assert(has(c, 'if (/^Saved/.test(msg)) snap.set(f, fieldsOf(f).map(el => [el, el.value]));'));
});

test('F15: the championship, rotation and audio editors say when a save failed', () => {
  for (const f of ['renderer/championshipui.js', 'renderer/rotationui.js', 'renderer/audioedit.js'])
    assert(/catch \(x\) \{\s*(say|msg)\('Could not save: '/.test(code(f)), f);
});

test('F16: a second attach lets go of the drag of the first (its timer stops)', () => {
  global.RotDrag = undefined;
  const src = fs.readFileSync(path.join(root, 'renderer/rotationdrag.js'), 'utf8');
  const timers = new Set();
  const ctx = vm.createContext({
    setInterval: () => {
      const id = Symbol('t');
      timers.add(id);
      return id;
    },
    clearInterval: id => timers.delete(id),
    setTimeout,
    Math
  });
  vm.runInContext(src + '\n;this.RotDrag = RotDrag;', ctx);
  const box = {};
  const chip = { dataset: { pp: '0', short: 'P1' }, closest: () => chip };
  ctx.RotDrag.attach(box, { d: { heats: [] }, find: () => null });
  box.onpointerdown({ target: chip, pointerId: 1, clientX: 0, clientY: 0, button: 0 });
  box.onpointermove({ pointerId: 1, clientX: 40, clientY: 0 });
  assert.equal(timers.size, 1, 'the drag scrolls near the edges');
  ctx.RotDrag.attach(box, { d: { heats: [] }, find: () => null });
  assert.equal(timers.size, 0, 'the editor drawn again: the old drag is gone');
});
