'use strict';
// Automatic backups (2.3.0): a complete backup by itself, every day or every week the app is used, into a folder of the person's choice
// (standard: Documents\SlotForge Timing backups), keeping the newest few. It makes the same backup as Import and Export > Back up
// (one .json file; with the shared library a .slotforge-backup folder), so it restores the same way.
// Never during a race, never while an import or restore runs, and only its own backups are ever removed: names of the exact form
//   SlotForge-Timing-auto-YYYY-MM-DD-HHMMSS.json  or  ...-HHMMSS.slotforge-backup
// What happened last is kept in a small state file (lastAt, lastPath, ok, error, bytes).
const fs = require('node:fs'),
  path = require('node:path');

const PREFIX = 'SlotForge-Timing-auto-',
  OWN = /^SlotForge-Timing-auto-\d{4}-\d{2}-\d{2}-\d{6}(-\d{1,3})?(\.json|\.slotforge-backup)$/, // (-2, -3…: a second backup in the same second)
  // (2.4.0, SlotForgeRestyle.md "Backup Vault") also the backups made by hand (Back up now) and the safety backups made before a restore or an
  // import: in the same folder, never removed by the app
  ANY = /^SlotForge-Timing-(auto|hand|safety)-(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})(-\d{1,3})?(\.json|\.slotforge-backup)$/,
  KINDS = ['auto', 'hand', 'safety'],
  DAY = 24 * 3600 * 1000,
  SLACK = 3600 * 1000; // (a backup made at 20:05 yesterday is due again at 19:05 today: club nights do not start at the same minute)

function config(settings, defaultFolder) {
  const a = (settings && settings.autoBackup) || {},
    keep = Math.floor(Number(a.keep));
  return {
    on: a.on !== false,
    every: a.every === 'week' ? 'week' : 'day',
    keep: keep >= 1 && keep <= 60 ? keep : 7,
    folder: typeof a.folder === 'string' && path.isAbsolute(a.folder) ? a.folder : defaultFolder
  };
}
function due(cfg, lastAt, now) {
  if (!cfg.on) return false;
  const last = Date.parse(lastAt || '');
  if (!Number.isFinite(last) || last > now) return true;
  return now - last >= (cfg.every === 'week' ? 7 : 1) * DAY - SLACK;
}
const two = n => String(n).padStart(2, '0');
function nameOf(date, folderKind, kind = 'auto') {
  const d = new Date(date);
  return (
    `SlotForge-Timing-${KINDS.includes(kind) ? kind : 'auto'}-` +
    `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}` +
    (folderKind ? '.slotforge-backup' : '.json')
  );
}
// a name that is not taken yet, so a failed run can remove what it made without touching an earlier backup of the same second
function freeName(folder, name) {
  const ext = name.endsWith('.slotforge-backup') ? '.slotforge-backup' : '.json',
    base = name.slice(0, -ext.length);
  let n = 1,
    p = path.join(folder, name);
  while (fs.existsSync(p) && n < 999) p = path.join(folder, base + '-' + ++n + ext);
  return p;
}
// (newest first also within one second: -2 after the plain name, -10 after -9)
const order = n =>
  n.replace(/-(\d{6})(?:-(\d{1,3}))?(\.json|\.slotforge-backup)$/, (m, t, k, e) => `-${t}-${String(k || 1).padStart(3, '0')}${e}`);
// the automatic backups in a folder, newest first
function own(folder) {
  let names = [];
  try {
    names = fs.readdirSync(folder);
  } catch {
    return [];
  }
  return names.filter(n => OWN.test(n)).sort((a, b) => (order(a) < order(b) ? 1 : order(a) > order(b) ? -1 : 0));
}
function sizeOf(p) {
  try {
    const st = fs.statSync(p);
    if (!st.isDirectory()) return st.size;
    return fs.readdirSync(p).reduce((sum, n) => sum + sizeOf(path.join(p, n)), 0);
  } catch {
    return 0;
  }
}
// (2.4.0) every backup of the app in a folder, newest first: { name, path, kind, date (from the name), folder (a .slotforge-backup folder) }
function list(folder) {
  let names = [];
  try {
    names = fs.readdirSync(folder);
  } catch {
    return [];
  }
  return names
    .map(name => {
      const m = ANY.exec(name);
      if (!m) return null;
      const date = new Date(+m[2], +m[3] - 1, +m[4], +m[5], +m[6], +m[7]);
      return {
        name,
        path: path.join(folder, name),
        kind: m[1],
        date: date.toISOString(),
        folder: m[9] === '.slotforge-backup',
        order: order(name.replace(/-(auto|hand|safety)-/, '-x-'))
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.order < b.order ? 1 : a.order > b.order ? -1 : 0))
    .map(({ order: _o, ...x }) => x);
}
// removes the oldest automatic backups beyond `keep` (nothing else in the folder is touched) -> the names removed
function prune(folder, keep) {
  const gone = own(folder).slice(keep);
  for (const n of gone) fs.rmSync(path.join(folder, n), { recursive: true, force: true });
  return gone;
}

// o: { settings() -> the app settings, defaultFolder, stateFile, busy() -> a reason not to run now (a race, an import) or '',
//      make(target, folderKind) -> makes the backup at target, folderKind() -> true when the backup is a folder (the shared library),
//      now(), onChange(status) }
function createAutoBackup(o) {
  const now = o.now || (() => Date.now());
  let running = null,
    timer = null;
  const readState = () => {
    try {
      return JSON.parse(fs.readFileSync(o.stateFile, 'utf8')) || {};
    } catch {
      return {};
    }
  };
  const writeState = s => {
    fs.mkdirSync(path.dirname(o.stateFile), { recursive: true });
    fs.writeFileSync(o.stateFile, JSON.stringify(s));
  };
  function status() {
    const cfg = config(o.settings(), o.defaultFolder),
      s = readState(),
      list = own(cfg.folder);
    const last = Date.parse(s.lastAt || '');
    return {
      ...cfg,
      ...s,
      running: !!running,
      count: list.length,
      defaultFolder: o.defaultFolder,
      next: cfg.on && Number.isFinite(last) ? new Date(last + (cfg.every === 'week' ? 7 : 1) * DAY - SLACK).toISOString() : ''
    }; // (2.4.0: when the next one is due)
  }
  // opts (2.4.0): { kind: 'auto' | 'hand' (Back up now) | 'safety' (before a restore or an import), note }: a backup by hand or for safety is kept
  // (only automatic ones are removed), and is made also while an import is busy (never during a race)
  async function run(reason = 'scheduled', opts = {}) {
    if (running) return running;
    const kind = KINDS.includes(opts.kind) ? opts.kind : 'auto';
    running = (async () => {
      const cfg = config(o.settings(), o.defaultFolder),
        busy = o.busy ? o.busy() : '';
      if (busy && (kind === 'auto' || busy === 'a race is open')) return { skipped: busy };
      const before = readState(),
        folderKind = !!(o.folderKind && o.folderKind()),
        target = freeName(cfg.folder, nameOf(now(), folderKind, kind));
      try {
        fs.mkdirSync(cfg.folder, { recursive: true });
        await o.make(target, folderKind);
        if (o.afterMake) await o.afterMake(target, { kind, note: String(opts.note || '').slice(0, 120), reason });
        const removed = prune(cfg.folder, cfg.keep);
        const s = {
          lastAt: new Date(now()).toISOString(),
          lastPath: target,
          ok: true,
          error: '',
          bytes: sizeOf(target),
          reason,
          removed: removed.length
        };
        writeState(s);
        return s;
      } catch (e) {
        try {
          fs.rmSync(target, { recursive: true, force: true }); // (a half-made backup is not left looking like a good one)
        } catch {
          /* nothing was made */
        }
        const s = { ...before, ok: false, error: String((e && e.message) || e), failedAt: new Date(now()).toISOString(), reason };
        writeState(s);
        return s;
      }
    })();
    try {
      return await running;
    } finally {
      running = null;
      if (o.onChange) o.onChange(status());
    }
  }
  // a check now and then: a backup when one is due (a failed one is tried again at the next check, not at once)
  async function tick() {
    const cfg = config(o.settings(), o.defaultFolder),
      s = readState();
    const failedRecently = s.ok === false && Number.isFinite(Date.parse(s.failedAt)) && now() - Date.parse(s.failedAt) < 6 * SLACK;
    if (!due(cfg, s.lastAt, now()) || failedRecently) return null;
    return run('scheduled');
  }
  function start({ firstMs = 90 * 1000, everyMs = 30 * 60 * 1000 } = {}) {
    stop();
    timer = setTimeout(function again() {
      tick().catch(() => {});
      timer = setTimeout(again, everyMs);
    }, firstMs);
    if (timer.unref) timer.unref();
  }
  function stop() {
    if (timer) clearTimeout(timer);
    timer = null;
  }
  return { run, tick, start, stop, status };
}

module.exports = { createAutoBackup, config, due, nameOf, own, list, prune, PREFIX, OWN, ANY };
