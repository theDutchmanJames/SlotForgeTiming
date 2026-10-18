// Plays the announcements of an audio set: a line with a sound file plays the file, a line with text is spoken by a Windows voice.
// Calls wait in a queue so they do not talk over each other; start and flag calls go first and drop what is waiting.
(function (root) {
  const A = typeof module !== 'undefined' ? require('./announcer.js') : root.Announcer;
  const MAX_FILE = 10000000; // bytes of a sound file (10 MB: about ten minutes of MP3). Sound files are saved inside the database, so there has to be some limit (it was 1.5 MB before 1.1.0)
  const URGENT = ['prerace', 'countdown5', 'countdown4', 'countdown3', 'countdown2', 'countdown1', 'lightsout', 'yellowflag', 'redflag', 'greenflag', 'finished'];
  const num = (v, d, lo, hi) => { const n = Number(v); return Number.isFinite(n) && v !== '' && v !== null ? Math.max(lo, Math.min(hi, n)) : d; };

  // a new set starts with every call on and its default sentences
  function defaultSet(name) {
    const calls = {}; A.CALLS.forEach(c => { calls[c.id] = { on: c.defaultOn !== false, lines: c.lines.map(text => ({ text, file: '' })) }; });
    return { name: name || 'New audio set', voice: '', rate: 1, pitch: 1, volume: 1, driverBy: 'name', distances: '50', lapsToGo: '3', minutesToGo: '1', closeGap: 1, battleLaps: 3, nearRecord: 0.1, noLapSeconds: 30, preDelay: 1, calls };
  }
  // the pause, in seconds, between the end of the pre-race call and the first start light (a set from before this setting: 1)
  const pauseOf = set => num(set && set.preDelay, 1, 0, 10);
  // A sentence can have conditions (line.only: { driver: id, top: n, time: seconds, gap: seconds }); all that are filled in must hold.
  // facts: what the race knows about the call: { driverId, place, time (ms), gap (ms) }. A condition about something that is not known does not hold.
  const hasOnly = o => !!o && ((typeof o.driver === 'string' && o.driver !== '') || o.top > 0 || o.time > 0 || o.gap > 0);
  function passes(only, facts) {
    if (!hasOnly(only)) return true;
    const f = facts || {};
    if (typeof only.driver === 'string' && only.driver !== '' && f.driverId !== only.driver) return false;
    if (only.top > 0 && !(f.place >= 1 && f.place <= only.top)) return false;
    if (only.time > 0 && !(f.time > 0 && f.time < only.time * 1000)) return false;
    if (only.gap > 0 && !(f.gap !== null && f.gap !== undefined && f.gap >= 0 && f.gap < only.gap * 1000)) return false;
    return true;
  }
  // what to play for a call: the chosen line (random among those that have something), with its words filled in. null = say nothing
  // A sentence with conditions that hold is chosen before the sentences without conditions; when no sentence has conditions that hold, one without conditions is chosen.
  function choose(set, callId, vars, rnd, facts) {
    if (callId === 'distance' && set && set.calls && !set.calls.distance && set.calls.halfway) set = { ...set, calls: { ...set.calls, distance: set.calls.halfway } }; // sets from before the distance call
    const def = A.CALLS.find(x => x.id === callId); // a call the set does not know yet (added in a later version) uses its ready-made sentences
    const c = set && set.calls && (set.calls[callId] || (def && { on: def.defaultOn !== false, lines: def.lines.map(text => ({ text, file: '' })) })); if (!c || c.on === false) return null;
    const lines = (c.lines || []).filter(l => l && ((l.file && String(l.file).startsWith('data:')) || String(l.text || '').trim()));
    if (!lines.length) return null;
    const fit = lines.filter(l => passes(l.only, facts)), special = fit.filter(l => hasOnly(l.only)), pool = special.length ? special : fit; // (what fits and has no conditions of its own)
    if (!pool.length) return null;
    const l = pool[Math.min(pool.length - 1, Math.floor((rnd || Math.random)() * pool.length))];
    return l.file && String(l.file).startsWith('data:') ? { file: l.file } : { text: A.fill(l.text, vars) };
  }

  // '25, 50 75' -> [25, 50, 75]; nothing filled in = 50; empty text = none
  const distances = v => (v === undefined || v === null ? [50] : String(v).split(/[\s,;]+/).map(Number).filter(n => n > 0 && n < 100));
  // '5, 3' -> [3, 5] whole numbers from 1 up; a set that does not have the setting yet uses `fallback`; empty text = none
  const counts = (v, fallback) => (v === undefined || v === null ? fallback : [...new Set(String(v).split(/[\s,;]+/).map(Number).filter(n => Number.isInteger(n) && n >= 1))].sort((a, b) => a - b));
  // a number from lo to hi; a set that does not have the setting yet (or text that is no number) uses `fallback`
  const bounded = (v, fallback, lo, hi) => { const n = Number(v); return v !== undefined && v !== null && v !== '' && Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback; };
  const S = { queue: [], busy: false, gen: 0, backend: null, log: [], cool: new Map(), now: () => Date.now() }; // (gen: counts the times everything was stopped; a call that was cut off must not release the one that came after it)
  // the browser's own voices and sound player (replaced in tests)
  function browser() {
    let cur = null; // what is playing now: held here, so that the browser does not collect it before it has ended, and so that it can be ended
    const end = c => { if (cur === c) cur = null; clearTimeout(c.t); c.done(); };
    return {
      voices: () => (root.speechSynthesis ? root.speechSynthesis.getVoices() : []),
      speak(text, o, done) {
        if (!root.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') return done();
        const u = new SpeechSynthesisUtterance(text); u.rate = o.rate; u.pitch = o.pitch; u.volume = o.volume;
        const v = o.voice && root.speechSynthesis.getVoices().find(x => x.name === o.voice); if (v) { u.voice = v; u.lang = v.lang; }
        const c = { u, done, t: setTimeout(() => end(c), Math.max(5000, String(text).length * 200 / (o.rate || 1))) }; // (a voice that never says it has finished does not hold up the calls that follow)
        cur = c; u.onend = u.onerror = () => end(c); root.speechSynthesis.speak(u);
      },
      file(url, o, done) { try { const a = new root.Audio(url); a.volume = o.volume; const c = { a, done, t: null }; cur = c; a.onended = a.onerror = () => end(c); const p = a.play(); if (p && p.catch) p.catch(() => end(c)); } catch (e) { done(); } },
      stop() {
        if (root.speechSynthesis) root.speechSynthesis.cancel();
        const c = cur; if (c && c.a) { try { c.a.onended = c.a.onerror = null; c.a.pause(); } catch (e) { /* it is gone */ } end(c); } // (a recorded file stops too, not only the voice)
      }
    };
  }
  const be = () => S.backend || (S.backend = browser());
  function next() {
    if (S.busy) return; const it = S.queue.shift(); if (!it) return;
    S.busy = true; let over = false; const gen = S.gen;
    const done = () => { if (over) return; over = true; const mine = gen === S.gen; if (mine) S.busy = false; if (typeof it.after === 'function') { try { it.after(); } catch (e) { /* what follows a call never breaks the sound */ } } if (mine) next(); }; // (a call that was cut off by an urgent one or by Stop ends without starting the next, which is already going)
    const o = { rate: num(it.set.rate, 1, 0.5, 2), pitch: num(it.set.pitch, 1, 0, 2), volume: num(it.set.volume, 1, 0, 1), voice: it.set.voice || '' };
    S.log.push(it.what.file ? 'file' : it.what.text); if (S.log.length > 200) S.log.splice(0, S.log.length - 200);
    if (it.what.file) be().file(it.what.file, o, done); else be().speak(it.what.text, o, done);
  }
  // "not again within N seconds": a call of the set (call.cooldown, call.coolFor 'driver' = counted for each driver) that was said lately is not said again; a call that is held back does not start a new wait
  function cooling(set, callId, vars, facts) {
    const c = set && set.calls && set.calls[callId], secs = num(c && c.cooldown, 0, 0, 3600); if (!(secs > 0)) return false;
    const who = c.coolFor === 'driver' ? '|' + ((facts && facts.driverId) || (vars && vars.driver) || '') : '', key = (set.id || set.name || '') + '|' + callId + who, t = S.now();
    if (S.cool.has(key) && t - S.cool.get(key) < secs * 1000) return true;
    S.cool.set(key, t); return false;
  }
  // a new race: nothing was said lately
  const resetCool = () => { S.cool = new Map(); };
  // say a call now (or as soon as the earlier ones are done); returns what was played, or null. after: called once when it has been said (or could not be played)
  function say(set, callId, vars, rnd, after, facts) {
    const what = choose(set, callId, vars, rnd, facts); if (!what) return null;
    if (cooling(set, callId, vars, facts)) return null;
    if (URGENT.includes(callId)) { S.queue = []; S.gen++; if (be().stop) be().stop(); S.busy = false; }
    else if (S.queue.length > 3) S.queue.shift(); // an old news item is not worth reading out
    S.queue.push({ set, what, after }); next(); return what;
  }
  function stop() { S.queue = []; S.busy = false; S.gen++; if (S.backend && S.backend.stop) S.backend.stop(); else if (root.speechSynthesis) root.speechSynthesis.cancel(); }
  const voices = () => { try { return be().voices ? be().voices() : []; } catch (e) { return []; } };

  // The voice report (1.16.1): the voices the app is offered by the browser inside it, and what Windows lists (voicereport.js: host = { windows, os, parts: [{ title, lines }] }), as text
  // that can be copied and sent. o: { ua (the browser's name), voices: [{ name, lang, localService }], host }
  function reportText(o) {
    o = o || {}; const ua = String(o.ua || ''), pick = (re, label) => { const m = re.exec(ua); return m ? `${label} ${m[1]}` : ''; }, voices = o.voices || [], host = o.host || null;
    const lines = ['SlotForge Timing: voice report', [pick(/Electron\/([\d.]+)/, 'Electron'), pick(/Chrome\/([\d.]+)/, 'Chromium')].filter(Boolean).join(', ') + (host && host.os ? ` on ${host.os}` : ''), '',
      `Voices the app is offered (${voices.length}):`, ...(voices.length ? voices.map(v => `  ${v.name} | ${v.lang || '?'} | ${v.localService === false ? 'online' : 'on this computer'}`) : ['  (none)'])];
    if (!host) lines.push('', 'The voice lists of Windows could not be asked.');
    else if (!host.windows) lines.push('', 'This computer is not running Windows, so there are no Windows voice lists to show.');
    else (host.parts || []).forEach(p => lines.push('', `${p.title}:`, ...(p.lines || []).map(l => `  ${l}`)));
    return lines.join('\n');
  }

  const api = { MAX_FILE, reportText, distances, counts, bounded, defaultSet, choose, passes, hasOnly, say, resetCool, stop, voices, pauseOf, state: S };
  root.Sound = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
