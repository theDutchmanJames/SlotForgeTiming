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
    return { name: name || 'New audio set', voice: '', rate: 1, pitch: 1, volume: 1, driverBy: 'name', distances: '50', lapsToGo: '3', minutesToGo: '1', closeGap: 1, battleLaps: 3, nearRecord: 0.1, noLapSeconds: 30, preDelay: 1, ambVolume: 0.8, ambDuck: true, ambDuckLevel: 35, ambMax: 6, calls };
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
  const S = { queue: [], busy: false, gen: 0, backend: null, log: [], cool: new Map(), now: () => Date.now(), ambBackend: null, amb: { items: [], pending: [], duck: false, log: [] }, later: (fn, ms) => setTimeout(fn, ms), unlater: t => clearTimeout(t) }; // (gen: counts the times everything was stopped; a call that was cut off must not release the one that came after it)
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
    S.busy = true; ambDuck(true); let over = false; const gen = S.gen; // (while a call is said, the ambient sounds are lowered, when the set says so)
    const done = () => { if (over) return; over = true; const mine = gen === S.gen; if (mine) S.busy = false; if (typeof it.after === 'function') { try { it.after(); } catch (e) { /* what follows a call never breaks the sound */ } } if (mine) { next(); if (!S.busy) ambDuck(false); } }; // (a call that was cut off by an urgent one or by Stop ends without starting the next, which is already going)
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
  // ---- Ambient Race Sounds (1.48.0) ----
  // Sound files the user brings, played on a channel of their own: they do not wait in the queue of the spoken calls, are not cut off by an urgent call, and any number (up to the limit of the set) can play
  // at the same time as each other and as the voice. A sound starts when an event of the race happens (Announcer.AMBIENT says which: on) and can be cut short by another (stop).
  // set: ambVolume (0 to 1), ambDuck (lower them while a call is said), ambDuckLevel (percent they are lowered to), ambMax (most sounds at once); call: vol (percent), delay (seconds), who/near, cut.
  const ambOf = set => ({ volume: num(set && set.ambVolume, 0.8, 0, 1), duck: !(set && set.ambDuck === false), level: num(set && set.ambDuckLevel, 35, 0, 100) / 100, max: Math.round(num(set && set.ambMax, 6, 1, 16)) });
  const ambVol = (set, call, ducked) => { const o = ambOf(set); return Math.max(0, Math.min(1, o.volume * num(call && call.vol, 100, 0, 100) / 100 * (ducked && o.duck ? o.level : 1))); };
  // the browser's own player (replaced in tests): play(url, volume, ended) returns { stop(), volume(v) }
  function ambientBrowser() {
    return { play(url, vol, ended) {
      try {
        const a = new root.Audio(url); a.volume = vol; a.onended = a.onerror = ended;
        const p = a.play(); if (p && p.catch) p.catch(() => ended());
        return { stop() { try { a.onended = a.onerror = null; a.pause(); } catch (e) { /* it is gone */ } }, volume(v) { try { a.volume = v; } catch (e) { /* it is gone */ } } };
      } catch (e) { ended(); return null; }
    } };
  }
  const abe = () => S.ambBackend || (S.ambBackend = ambientBrowser());
  const ambEnd = it => { const i = S.amb.items.indexOf(it); if (i >= 0) S.amb.items.splice(i, 1); };
  const ambHalt = it => { ambEnd(it); try { if (it.h) it.h.stop(); } catch (e) { /* it is gone */ } };
  // lower the sounds that play (and the ones that start while it lasts) while a call is said, back up when it is over
  function ambDuck(on) {
    if (S.amb.duck === on) return; S.amb.duck = on;
    S.amb.items.forEach(it => { try { if (it.h) it.h.volume(ambVol(it.set, it.call, on)); } catch (e) { /* it is gone */ } });
  }
  // which car an event is about (the pit stop that ends is the one that began): the lane, else the driver
  const ambKey = (vars, facts) => String(vars && vars.lane !== undefined && vars.lane !== '' ? vars.lane : (vars && vars.driver) || (facts && facts.driverId) || '');
  function ambStart(set, id, call, file, key) {
    const max = ambOf(set).max, items = S.amb.items;
    while (items.length >= max) ambHalt(items[0]); // (the oldest makes room: a new sound matters more than one that has played a while)
    const it = { id, key, set, call, h: null }; items.push(it);
    S.amb.log.push({ id, file: file.slice(0, 40), volume: ambVol(set, call, S.amb.duck) }); if (S.amb.log.length > 200) S.amb.log.splice(0, S.amb.log.length - 200);
    try { it.h = abe().play(file, ambVol(set, call, S.amb.duck), () => ambEnd(it)); } catch (e) { ambEnd(it); } // (a player that cannot play leaves nothing behind that would take the place of another sound)
    return it;
  }
  // an event cuts a sound that has not ended (or has not started: the delay is waiting) for the same car
  function ambCut(id, key) {
    S.amb.pending = S.amb.pending.filter(p => { if (p.id === id && p.key === key) { S.unlater(p.timer); return false; } return true; });
    S.amb.items.filter(it => it.id === id && it.key === key).forEach(ambHalt);
  }
  // one ambient sound (def of Announcer.AMBIENT) for an event: null when it is off, has no file, is held back by "which cars", or is cooling down
  function ambPlay(set, def, vars, facts, rnd) {
    const c = set.calls && set.calls[def.id]; if (!c || c.on === false) return null;
    if ((def.opts || []).includes('who')) {
      const f = facts || {};
      if (c.who === 'leader' && f.place !== 1) return null;
      if (c.who === 'close') { const lim = num(c.near, 3, 0.1, 60) * 1000, near = x => typeof x === 'number' && x >= 0 && x < lim; if (!near(f.gap) && !near(f.behind)) return null; } // (the car is close to the one in front or the one behind)
    }
    const what = choose(set, def.id, vars, rnd, facts); if (!what || !what.file) return null;
    if (cooling(set, def.id, vars, facts)) return null;
    const key = ambKey(vars, facts), delay = num(c.delay, 0, 0, 30);
    if (delay > 0) { const p = { id: def.id, key, timer: null }; p.timer = S.later(() => { S.amb.pending = S.amb.pending.filter(x => x !== p); try { ambStart(set, def.id, c, what.file, key); } catch (e) { /* a sound problem never stops the race */ } }, delay * 1000); S.amb.pending.push(p); }
    else ambStart(set, def.id, c, what.file, key);
    return { id: def.id, file: what.file };
  }
  // an event of the race (the id of the call about to be said, or lapdone): the ambient sounds that end because of it, then the ones that start because of it
  function ambientFor(set, event, vars, facts, rnd) {
    if (!set || !set.calls) return [];
    const key = ambKey(vars, facts);
    A.AMBIENT.forEach(def => { if ((def.stop || []).includes(event) && (set.calls[def.id] || {}).cut !== false) ambCut(def.id, key); });
    return A.AMBIENT.filter(def => def.on.includes(event)).map(def => ambPlay(set, def, vars, facts, rnd)).filter(Boolean);
  }
  // does the set want a sound for every lap of every car? (the announcer only makes the lap event when it does)
  const wantsLaps = set => { const c = set && set.calls && set.calls.ambpass; return !!c && c.on !== false && (c.lines || []).some(l => l && String(l.file || '').startsWith('data:')); };
  function ambStopAll() { S.amb.pending.forEach(p => S.unlater(p.timer)); S.amb.pending = []; S.amb.items.slice().forEach(ambHalt); S.amb.duck = false; }
  // a sound of the set played at once (the Test button of the audio editor): with the volume of the set and of the call
  function ambientTest(set, id, file) {
    if (!file || !String(file).startsWith('data:')) return false;
    try { ambStart(set, id, (set.calls && set.calls[id]) || {}, file, 'test'); return true; } catch (e) { return false; }
  }
  // a new race: nothing was said lately
  const resetCool = () => { S.cool = new Map(); };
  // say a call now (or as soon as the earlier ones are done); returns what was played, or null. after: called once when it has been said (or could not be played)
  function say(set, callId, vars, rnd, after, facts) {
    try { ambientFor(set, callId, vars, facts, rnd); } catch (e) { /* a sound problem never stops the race, or the voice */ } // (the ambient sounds of this event: on their own channel, whether or not the call is said)
    const what = choose(set, callId, vars, rnd, facts); if (!what) return null;
    if (cooling(set, callId, vars, facts)) return null;
    if (URGENT.includes(callId)) { S.queue = []; S.gen++; if (be().stop) be().stop(); S.busy = false; }
    else if (S.queue.length > 3) S.queue.shift(); // an old news item is not worth reading out
    S.queue.push({ set, what, after }); next(); return what;
  }
  function stop() { S.queue = []; S.busy = false; S.gen++; ambStopAll(); if (S.backend && S.backend.stop) S.backend.stop(); else if (root.speechSynthesis) root.speechSynthesis.cancel(); }
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

  const api = { MAX_FILE, reportText, distances, counts, bounded, defaultSet, choose, passes, hasOnly, say, resetCool, stop, voices, pauseOf, ambientOf: ambOf, ambientFor, wantsLaps, ambientTest, state: S };
  root.Sound = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
