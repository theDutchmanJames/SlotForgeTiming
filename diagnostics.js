'use strict';
// "Save diagnostics" (App Settings > General): one text file for a bug report. It holds what helps to find a problem and leaves out
// what is private: no passwords, PINs, tokens or keys, no names, welcome texts, pictures or logos, no long texts, and the user's own
// folder is written as %USERPROFILE% (or ~). The person can read the file before sending it.

const SECRET = /pass(word)?|pin\b|pin$|token|secret|key$|apikey|credential/i;
const PRIVATE = new Set(['appName', 'welcome', 'clubLogo', 'homeHeader', 'directorPassword', 'paddockPassword', 'dealershipPassword']);
const MAX_TEXT = 120;

// settings without secrets, names and pictures; long texts and data are replaced by what they are
function cleanSettings(settings) {
  const out = {};
  for (const [k, v] of Object.entries(settings || {})) {
    if (SECRET.test(k) || PRIVATE.has(k)) {
      out[k] = v === undefined || v === null || v === '' ? v : '[left out]';
      continue;
    }
    out[k] = cleanValue(v, 0);
  }
  return out;
}
function cleanValue(v, depth) {
  if (typeof v === 'string') {
    if (v.startsWith('data:')) return `[picture or file, ${v.length} characters]`;
    return v.length > MAX_TEXT ? `[text, ${v.length} characters]` : v;
  }
  if (Array.isArray(v)) return depth > 3 ? `[list of ${v.length}]` : v.slice(0, 50).map(x => cleanValue(x, depth + 1));
  if (v && typeof v === 'object') {
    if (depth > 3) return '[object]';
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = SECRET.test(k) || PRIVATE.has(k) ? '[left out]' : cleanValue(x, depth + 1);
    return o;
  }
  return v;
}
// the user's own folder (it holds their Windows/macOS user name) becomes %USERPROFILE% / ~
function redactPaths(text, home) {
  let s = String(text);
  if (home) {
    const variants = new Set([home, home.replace(/\\/g, '/'), home.replace(/\//g, '\\'), home.replace(/\\/g, '\\\\')]);
    for (const h of variants) if (h.length > 3) s = s.split(h).join(home.includes('\\') ? '%USERPROFILE%' : '~');
  }
  // any other user folder too, also in its short Windows form (C:\Users\THEDUT~1) or with doubled backslashes inside JSON
  return s.replace(/(?:[A-Za-z]:)?(?:\\\\|\\|\/)(?:Users|home)(?:\\\\|\\|\/)(?!%USERPROFILE%)[^\\/"'\s:*?<>|]+/gi, m =>
    /^[A-Za-z]:|\\/.test(m) ? '%USERPROFILE%' : '~'
  );
}
const section = (title, body) => `== ${title} ==\n${typeof body === 'string' ? body : JSON.stringify(body, null, 2)}\n`;

// info: { app, versions, system, storage, settings, timing, network, library, plugins, update, errors: [lines] }; home: the user's folder
function report(info, home) {
  const parts = [
    'SlotForge Timing diagnostics',
    `Saved: ${new Date(info.when || Date.now()).toISOString()}`,
    'Passwords, names, pictures and long texts are left out. Read this file before you send it to anyone.',
    '',
    section('App', info.app || {}),
    section('Versions', info.versions || {}),
    section('System', info.system || {}),
    section('Storage', info.storage || {}),
    section('Timing hardware', info.timing || {}),
    section('Network sharing', info.network || {}),
    section('Shared library (Paddock)', info.library || {}),
    section('Plugins', info.plugins || []),
    section('Update check', info.update || {}),
    section('Settings (cleaned)', cleanSettings(info.settings)),
    section('Recent errors and warnings', (info.errors || []).length ? info.errors.join('\n') : '(none)')
  ];
  return redactPaths(parts.join('\n'), home);
}

// a small ring of recent errors and warnings (main process and pages), kept in memory only
function createErrorLog(max = 200) {
  const lines = [];
  const add = (level, text) => {
    lines.push(`${new Date().toISOString()} ${level} ${String(text).replace(/\s+$/, '').slice(0, 2000)}`);
    if (lines.length > max) lines.splice(0, lines.length - max);
  };
  return { add, lines: () => lines.slice() };
}

module.exports = { report, cleanSettings, redactPaths, createErrorLog };
