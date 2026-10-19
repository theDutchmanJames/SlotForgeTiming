// Customization > Audio Settings: audio sets (voice, and per call the sentences or sound files)
let audEd = null; // { id, draft, dirty }
// the tooltip on the Voice choice: the voices are the ones installed in Windows
const VOICE_HELP = 'To add more voices and languages to Windows:\nWindows 11: Settings > Time & language > Speech > Manage voices > Add voices.\nWindows 10: Settings > Time & language > Language, add the language, and tick its Text-to-speech option.\nThen restart this app.\nThe Natural and Natural HD voices that Windows 11 adds for Narrator (such as Andrew) are, as far as we know, not offered to other apps. Voice report shows what this computer offers.';
// the tooltip on the folder of the Ambient Race Sounds
const AMBIENT_HELP = 'These sounds play on a separate channel: they play at the same time as the spoken calls, and a spoken call never cuts them off.';
let audVoiceNote = false; // the answer to "How do I get more voices?" is shown (it stays shown when the editor is drawn again)
let audOpen = new Set(); // the call groups (folders) that are open in the editor; all closed when a set is opened
let audCond = new Set(); // the sentences whose "Only if" box is open ("call:number"); closed when a set is opened
let audDrivers = []; // the drivers of the database, for the "only for driver" condition
// the text on the "Only if" line of a sentence: what is set
const condWords = (o, drivers) => { const out = [];
  if (o && o.driver) { const dr = (drivers || []).find(x => x.id === o.driver); out.push(dr ? dr.name : 'a driver that is gone'); }
  if (o && o.top > 0) out.push('top ' + o.top);
  if (o && o.time > 0) out.push('lap under ' + o.time + ' s');
  if (o && o.gap > 0) out.push('gap under ' + o.gap + ' s');
  return out; };

async function renderAudioSets(box) {
  if (audEd) return renderAudioSetEditor(box);
  manager = null;
  const sets = await api.list('audiosets');
  box.innerHTML = `<p class="muted">An audio set holds everything the race says: the voice and, for each call (start, new leader, fastest lap, flags...), one or more sentences. Make a set here, then choose it in a Race Setup. A race setup with "No audio" stays silent. Sound is played on the computer that runs the race.</p>
    <div class="row"><button class="btn primary" id="newaud">New audio set</button></div>
    <div class="wrap"><table class="fields"><tr><th>Name</th><th>Voice</th><th>Calls on</th><th></th></tr>` +
    (sets.length ? sets.map(r => `<tr><td>${esc(r.name)}</td><td>${esc(r.voice || 'Default voice')}</td><td>${Announcer.CALLS.filter(c => (r.calls || {})[c.id] && r.calls[c.id].on !== false).length} of ${Announcer.CALLS.length}</td><td class="actions">
      <button class="btn" data-edit="${esc(r.id)}">Edit</button> <button class="btn" data-dup="${esc(r.id)}">Duplicate</button> <button class="btn danger" data-del="${esc(r.id)}">Delete</button></td></tr>`).join('') : '<tr><td colspan="4" class="muted">No audio sets yet.</td></tr>') + '</table></div>';
  box.onclick = async ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.id === 'newaud') { audDrivers = await api.list('drivers'); audEd = { id: null, draft: Sound.defaultSet(), dirty: true }; audOpen = new Set(); audCond = new Set(); return renderAudioSets(box); }
    const r = sets.find(x => x.id === (b.dataset.edit || b.dataset.dup || b.dataset.del)); if (!r) return;
    const own = () => { const d = Sound.defaultSet(r.name); Object.assign(d, clone({ voice: r.voice, rate: r.rate, pitch: r.pitch, volume: r.volume, driverBy: r.driverBy, distances: r.distances, lapsToGo: r.lapsToGo, minutesToGo: r.minutesToGo, closeGap: r.closeGap, battleLaps: r.battleLaps, nearRecord: r.nearRecord, noLapSeconds: r.noLapSeconds, preDelay: r.preDelay, ambVolume: r.ambVolume, ambDuck: r.ambDuck, ambDuckLevel: r.ambDuckLevel, ambMax: r.ambMax })); Object.keys(r.calls || {}).forEach(k => { d.calls[k] = clone(r.calls[k]); }); return d; };
    if (b.dataset.edit) { audDrivers = await api.list('drivers'); audEd = { id: r.id, draft: own(), dirty: false }; audOpen = new Set(); audCond = new Set(); return renderAudioSets(box); }
    if (b.dataset.dup) { const d = own(); d.name = r.name + ' (copy)'; await api.add('audiosets', d); return renderAudioSets(box); }
    if (b.dataset.del && confirm(`Delete the audio set "${r.name}"?\n\nRace setups that use it will be silent until you choose another set.\n\nThis can't be undone.`)) { await api.remove('audiosets', r.id); renderAudioSets(box); }
  };
}

function renderAudioSetEditor(box) {
  const d = audEd.draft, voices = Sound.voices(), groups = [];
  Announcer.CALLS.forEach(c => { let g = groups.find(x => x[0] === c.group); if (!g) groups.push(g = [c.group, []]); g[1].push(c); });
  // the "Only if" box of a sentence (conditions the call can have are shown), and the "not again within" row of a call
  const condHtml = (c, l, n) => {
    const cf = Announcer.conditionsOf(c); if (!(cf.driver || cf.top || cf.time || cf.gap)) return '';
    const o = l.only || {}, key = `${c.id}:${n}`, words = condWords(o, audDrivers), at = k => `data-cond="${k}" data-line="${key}"`;
    return `<details class="audcond" data-cond-key="${key}"${audCond.has(key) ? ' open' : ''}><summary>Only if&hellip;${words.length ? ` <span class="muted">(${esc(words.join(', '))})</span>` : ''}</summary><div class="row">
      ${cf.driver ? `<label>the driver is <select ${at('driver')} aria-label="Only for this driver, sentence ${n + 1} of ${esc(c.label)}"><option value="">anyone</option>${audDrivers.map(x => `<option value="${esc(x.id)}"${o.driver === x.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}${o.driver && !audDrivers.some(x => x.id === o.driver) ? `<option value="${esc(o.driver)}" selected>(a driver that is gone)</option>` : ''}</select></label>` : ''}
      ${cf.top ? `<label>the driver is in the top <input type="number" ${at('top')} min="1" max="99" step="1" value="${o.top > 0 ? o.top : ''}" style="width:4.5em" placeholder="any"></label>` : ''}
      ${cf.time ? `<label>the lap time is under (seconds) <input type="number" ${at('time')} min="0.1" max="3600" step="0.01" value="${o.time > 0 ? o.time : ''}" style="width:6em" placeholder="any"></label>` : ''}
      ${cf.gap ? `<label>the gap to the car in front is under (seconds) <input type="number" ${at('gap')} min="0.1" max="600" step="0.1" value="${o.gap > 0 ? o.gap : ''}" style="width:6em" placeholder="any"></label>` : ''}
      <span class="muted">Empty = no condition; all that are filled in must hold. A sentence whose conditions hold is said instead of the sentences without conditions.</span></div></details>`; };
  const coolHtml = c => {
    if (c.group === 'Start' || c.group === 'Finish') return ''; // (said once per race)
    const cc = d.calls[c.id], secs = Number(cc.cooldown) > 0 ? cc.cooldown : '';
    return `<div class="row audcool"><label>Not again within (seconds) <input type="number" data-cool="${c.id}" min="1" max="3600" step="1" value="${secs}" placeholder="no limit" style="width:6em"></label>${Announcer.conditionsOf(c).driver ? `<label>counted <select data-coolfor="${c.id}"><option value="all">for the whole ${c.section ? 'sound' : 'call'}</option><option value="driver"${cc.coolFor === 'driver' ? ' selected' : ''}>for each driver</option></select></label>` : ''}<span class="muted">After it has ${c.section ? 'played' : 'been said'}, the ${c.section ? 'sound' : 'call'} is held back for that long.</span></div>`; };
  const callHtml = c => { const cc = d.calls[c.id] || (d.calls[c.id] = { on: true, lines: [] });
    return `<fieldset class="audcall"><legend><label><input type="checkbox" data-on="${c.id}"${cc.on !== false ? ' checked' : ''}> ${esc(c.label)}</label></legend>
      <div ${cc.on === false ? 'hidden' : ''}>${c.id === 'distance' ? `<div class="row"><label>At these race distances (percent, separated by commas) <input type="text" id="au-dist" value="${esc(d.distances === undefined ? '50' : d.distances)}" style="width:12em" placeholder="e.g. 25, 50, 75"></label><span class="muted">A race by laps counts the leader's laps, a timed race the time. Empty = never.</span></div>` : ''}${c.id === 'lapstogo' ? `<div class="row"><label>When this many laps are left (separated by commas) <input type="text" id="au-lapsgo" value="${esc(d.lapsToGo === undefined ? '3' : d.lapsToGo)}" style="width:10em" placeholder="e.g. 5, 3"></label><span class="muted">The leader's laps count. The last lap has its own call, so 1 is left out. Empty = never.</span></div>` : ''}${c.id === 'timetogo' ? `<div class="row"><label>When this many minutes are left (separated by commas) <input type="text" id="au-mingo" value="${esc(d.minutesToGo === undefined ? '1' : d.minutesToGo)}" style="width:10em" placeholder="e.g. 5, 1"></label><span class="muted">Whole minutes. Empty = never.</span></div>` : ''}${c.id === 'closing' ? `<div class="row"><label>Close means a gap under (seconds) <input type="number" id="au-closegap" min="0.1" max="30" step="0.1" value="${esc(d.closeGap === undefined ? 1 : d.closeGap)}" style="width:5em"></label><span class="muted">The gap is measured at the line, every time the chasing car completes a lap. Said once each time a car comes this close; the battle call uses the same gap.</span></div>` : ''}${c.id === 'battle' ? `<div class="row"><label>Said when the gap has been that small for (laps in a row) <input type="number" id="au-battlelaps" min="2" max="20" step="1" value="${esc(d.battleLaps === undefined ? 3 : d.battleLaps)}" style="width:5em"></label><span class="muted">The gap is the one set under the "closes in" call.</span></div>` : ''}${c.id === 'nearrecord' ? `<div class="row"><label>Said when a lap is at most this close to the track record (seconds) <input type="number" id="au-nearrecord" min="0.01" max="5" step="0.01" value="${esc(d.nearRecord === undefined ? 0.1 : d.nearRecord)}" style="width:5em"></label><span class="muted">Only when the track has a record. Not said for a lap that beats it (that has its own call).</span></div>` : ''}${c.id === 'nolap' ? `<div class="row"><label>Said when a car has not completed a lap for (seconds) <input type="number" id="au-nolap" min="5" max="600" step="1" value="${esc(d.noLapSeconds === undefined ? 30 : d.noLapSeconds)}" style="width:5em"></label><span class="muted">Counted from the car's last lap (or the start). Said once for each stretch without a lap. Not for a car in the pits or one that is out of the race.</span></div>` : ''}${c.id === 'tyrelevel' ? `<p class="muted">The levels are set in the Tyre Wear System (Race Setup > Tyre Wear Systems, folder Warnings), so every race setup can have its own: 50, 25 and 10 percent of life left to begin with. Each level is said once for every set of tyres. Time Token Sessions have no tyre wear, so the Tyre wear calls are never said there.</p>` : ''}${c.id === 'prerace' ? `<p class="muted">Said as soon as Start is pressed. The start lights wait until it has been said, then there is a short pause, then the lights begin.</p><div class="row"><label>Pause after it, before the first light (seconds) <input type="number" id="au-pause" min="0" max="10" step="0.5" value="${esc(d.preDelay === undefined ? 1 : d.preDelay)}" style="width:5em"></label></div>` : ''}${(cc.lines || []).map((l, n) => `<div class="row audline"><input type="text" class="wide" data-text="${c.id}:${n}" value="${esc(l.text || '')}" aria-label="Sentence ${n + 1} of ${esc(c.label)}" placeholder="What to say">
        <span class="audfile">${l.file ? `<span class="muted">sound file</span> <button class="btn" type="button" data-nofile="${c.id}:${n}">Remove file</button>` : `<input type="file" accept="audio/*" data-file="${c.id}:${n}" aria-label="Sound file for sentence ${n + 1}">`}</span>
        <button class="btn" type="button" data-test="${c.id}:${n}">Test</button> <button class="btn" type="button" data-delline="${c.id}:${n}" aria-label="Delete this sentence">Delete</button></div>${condHtml(c, l, n)}`).join('')}
      <div class="row"><button class="btn" type="button" data-addline="${c.id}">Add a sentence</button>${c.vars.length ? `<span class="muted">You can use ${c.vars.map(v => `{${v}}`).join(' ')}</span>` : ''}</div>${coolHtml(c)}</div></fieldset>`; };
  // ---- the folder of the Ambient Race Sounds (1.48.0): sound files only, no sentences; they play on their own channel (see sound.js) ----
  const ambOpt = Sound.ambientOf(d), ambFiles = id => ((d.calls[id] || {}).lines || []).filter(l => l && l.file).length;
  const ambCallHtml = def => { const cc = d.calls[def.id] || (d.calls[def.id] = { on: true, lines: [] }), o = def.opts || [], hasDriver = def.vars.includes('driver'), at = k => `data-ambopt="${k}:${def.id}"`;
    const vol = cc.vol === undefined ? '' : cc.vol, delay = Number(cc.delay) > 0 ? cc.delay : '';
    return `<fieldset class="audcall ambcall"><legend><label><input type="checkbox" data-on="${def.id}"${cc.on !== false ? ' checked' : ''}> ${esc(def.label)}</label></legend>
      <div ${cc.on === false ? 'hidden' : ''}>${(cc.lines || []).map((l, n) => `<div class="row audline"><span class="audfile">${l.file ? `<span class="muted">sound file</span> <button class="btn" type="button" data-nofile="${def.id}:${n}">Remove file</button>` : `<input type="file" accept="audio/*" data-file="${def.id}:${n}" aria-label="Sound file ${n + 1} for ${esc(def.label)}">`}</span>
        <button class="btn" type="button" data-ambtest="${def.id}:${n}"${l.file ? '' : ' disabled'}>Test</button> <button class="btn" type="button" data-delline="${def.id}:${n}" aria-label="Delete this sound file">Delete</button></div>${condHtml(def, l, n)}`).join('')}
      <div class="row"><button class="btn" type="button" data-addline="${def.id}">Add a sound file</button><span class="muted">${(cc.lines || []).length > 1 ? 'One of the files is picked at random each time.' : (cc.lines || []).length ? '' : 'Nothing plays until a file is added.'}</span></div>
      <div class="row ambopts"><label>Volume (percent) <input type="number" ${at('vol')} min="0" max="100" step="5" value="${vol}" placeholder="100" style="width:5.5em"></label>
        <label>Start after (seconds) <input type="number" ${at('delay')} min="0" max="30" step="0.1" value="${delay}" placeholder="0" style="width:5.5em"></label>
        ${o.includes('who') ? `<label>Played for <select ${at('who')}><option value="">every car</option><option value="leader"${cc.who === 'leader' ? ' selected' : ''}>only the leader</option><option value="close"${cc.who === 'close' ? ' selected' : ''}>only cars close together</option></select></label>${cc.who === 'close' ? `<label>closer than (seconds) <input type="number" ${at('near')} min="0.1" max="60" step="0.1" value="${cc.near > 0 ? cc.near : ''}" placeholder="3" style="width:5.5em"></label>` : ''}` : ''}
        ${o.includes('cut') ? `<label><input type="checkbox" ${at('cut')}${cc.cut === false ? '' : ' checked'}> stop it when the car leaves the pits</label>` : ''}</div>${def.cool ? coolHtml(def) : ''}</div></fieldset>`; };
  const ambHtml = () => { let sec = '', body = '';
    Announcer.AMBIENT.forEach(def => { if (def.section !== sec) { sec = def.section; body += `<h4 class="ambsec">${esc(sec)}</h4>`; } body += ambCallHtml(def); });
    const withFile = Announcer.AMBIENT.filter(def => ambFiles(def.id) > 0).length, tip = esc(AMBIENT_HELP);
    return `<details class="audgroup ambgroup" data-group="${esc(Announcer.AMBIENT_GROUP)}" title="${tip}"${audOpen.has(Announcer.AMBIENT_GROUP) ? ' open' : ''}><summary title="${tip}"><strong>${esc(Announcer.AMBIENT_GROUP)}</strong> <span class="muted">${withFile} of ${Announcer.AMBIENT.length} sound${Announcer.AMBIENT.length === 1 ? '' : 's'} have a file</span> <span class="muted" aria-hidden="true">ⓘ</span></summary>
      <div class="ambintro"><p class="muted">${esc(AMBIENT_HELP)} No sounds are included: add your own sound files (engines passing, a pit crew, a crowd...) and each one plays when its moment of the race comes. A sound without a file stays silent.</p>
        <div class="row ambset"><label>Volume (percent) <input type="number" id="au-ambvol" min="0" max="100" step="5" value="${Math.round(ambOpt.volume * 100)}" style="width:5.5em"></label>
          <label><input type="checkbox" id="au-ambduck"${ambOpt.duck ? ' checked' : ''}> lower them while a call is spoken</label>
          <label>to (percent) <input type="number" id="au-ambdlvl" min="0" max="100" step="5" value="${Math.round(ambOpt.level * 100)}" style="width:5.5em"${ambOpt.duck ? '' : ' disabled'}></label>
          <label>Most sounds at once <input type="number" id="au-ambmax" min="1" max="16" step="1" value="${ambOpt.max}" style="width:5em"></label></div></div>${body}</details>`; };
  box.innerHTML = `<div class="ed-bar"><label>Name <input type="text" id="au-name" value="${esc(d.name)}" maxlength="40"></label>
      ${undoButtons('au')}<button class="btn primary" id="au-save">Save audio set</button><button class="btn" id="au-back">Back</button><span id="au-msg" class="muted" role="status"></span></div>
    <div class="ed-bar"><label title="${esc(VOICE_HELP)}">Voice <select id="au-voice" title="${esc(VOICE_HELP)}"><option value="">Default voice</option>${voices.map(v => `<option value="${esc(v.name)}"${v.name === d.voice ? ' selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label>
      <button type="button" class="linkbtn" id="au-voicehelp" aria-expanded="${audVoiceNote}" aria-controls="au-voicenote" title="${esc(VOICE_HELP)}">ⓘ How do I get more voices?</button>
      <button class="btn" type="button" id="au-vreport" title="Show the voices this computer offers to the app, to copy and send when a voice is missing">Voice report</button>
      <label>Speed <input type="number" id="au-rate" min="0.5" max="2" step="0.1" value="${esc(d.rate)}" style="width:5em"></label>
      <label>Pitch <input type="number" id="au-pitch" min="0" max="2" step="0.1" value="${esc(d.pitch)}" style="width:5em"></label>
      <label>Volume <input type="number" id="au-vol" min="0" max="1" step="0.1" value="${esc(d.volume)}" style="width:5em"></label>
      <label>Say drivers by their <select id="au-by">${[['name', 'name'], ['nickname', 'nickname'], ['callsign', 'callsign']].map(([k, t]) => `<option value="${k}"${d.driverBy === k ? ' selected' : ''}>${t}</option>`).join('')}</select></label></div>
    <p class="hint2" id="au-voicenote" role="note"${audVoiceNote ? '' : ' hidden'}>If you want more voices, the safe way is Windows Settings &gt; Time &amp; language &gt; Speech &gt; Manage voices &gt; Add voices. Voices added there should show up in the app after a restart. (Windows 10: Settings &gt; Time &amp; language &gt; Language, add the language and tick its Text-to-speech option.)</p>
    <div class="audvreport" id="au-vbox" hidden><p class="muted">The voices this computer offers to the app. Copy the report and send it if a voice is missing.</p>
      <textarea id="au-vtext" readonly rows="12" style="width:100%" aria-label="Voice report"></textarea><p><button class="btn" type="button" id="au-vcopy">Copy the report</button> <span class="muted" id="au-vmsg" role="status"></span></p></div>
    <details class="audhelp" open><summary><strong>How sentences work, and the variables you can use</strong></summary>
      <ul class="muted"><li>When a call has several sentences, one is picked at random each time.</li><li>A sentence with a sound file plays the file instead of speaking it (up to ${Sound.MAX_FILE / 1e6} MB per file; the files are saved inside the database, so keep them short).</li>
        <li>Put a variable in curly brackets inside a sentence, for example <code>{driver} takes the lead</code>. Each call lists the variables it can use under its sentences; a variable the call does not have is left out when spoken.</li></ul>
      <div class="wrap"><table class="fields"><tr><th>Variable</th><th>What it says</th><th>Example</th><th>Used in</th></tr>${Object.entries(Announcer.VARS).map(([k, t]) => {
        const used = Announcer.CALLS.filter(c => c.vars.includes(k) || (Announcer.EVERY_DRIVER.includes(k) && c.vars.includes('driver'))).map(c => c.label);
        return `<tr><td><code>{${k}}</code></td><td>${esc(t)}</td><td>${esc(Announcer.SAMPLE[k])}</td><td class="muted">${Announcer.EVERY_DRIVER.includes(k) ? 'Every call about a driver' : Announcer.EVERY_CALL.includes(k) ? 'Every call' : esc(used.join(', '))}</td></tr>`; }).join('')}</table></div></details>
    <div class="fgtools audtools"><strong>Calls</strong><button class="btn" type="button" data-openall="1">Open all folders</button><button class="btn" type="button" data-openall="0">Close all folders</button></div>
    ${groups.map(([g, list]) => { const on = list.filter(c => (d.calls[c.id] || {}).on !== false).length;
      return `<details class="audgroup" data-group="${esc(g)}"${audOpen.has(g) ? ' open' : ''}><summary><strong>${esc(g)}</strong> <span class="muted">${on} of ${list.length} call${list.length === 1 ? '' : 's'} on</span></summary>${list.map(callHtml).join('')}</details>`; }).join('')}${ambHtml()}`;
  box.querySelectorAll('.audcond').forEach(el => { el.ontoggle = () => { const k = el.dataset.condKey; if (el.open) audCond.add(k); else audCond.delete(k); }; });
  box.querySelectorAll('.audgroup').forEach(el => { el.ontoggle = () => { const g = el.dataset.group; if (el.open) audOpen.add(g); else audOpen.delete(g); }; }); // remembered when the editor redraws
  // Undo and redo (a typed sentence is one step after a quiet moment; every other change is a step of its own)
  const U = draftUndo(audEd, 'au', () => renderAudioSetEditor(box)), mark = U.mark, step = U.step;
  const $ = id => document.getElementById(id), msg = t => { $('au-msg').textContent = t; };
  const ref = s => { const [id, n] = s.split(':'); return d.calls[id].lines[Number(n)]; };
  $('au-name').oninput = e => { d.name = e.target.value; mark(); };
  $('au-voice').onchange = e => { d.voice = e.target.value; step(); };
  if ($('au-dist')) $('au-dist').onchange = e => { d.distances = e.target.value.trim(); step(); };
  if ($('au-lapsgo')) $('au-lapsgo').onchange = e => { d.lapsToGo = e.target.value.trim(); step(); };
  if ($('au-mingo')) $('au-mingo').onchange = e => { d.minutesToGo = e.target.value.trim(); step(); };
  if ($('au-closegap')) $('au-closegap').onchange = e => { d.closeGap = Sound.bounded(e.target.value, 1, 0.1, 30); e.target.value = d.closeGap; step(); };
  if ($('au-nearrecord')) $('au-nearrecord').onchange = e => { d.nearRecord = Sound.bounded(e.target.value, 0.1, 0.01, 5); e.target.value = d.nearRecord; step(); };
  if ($('au-nolap')) $('au-nolap').onchange = e => { d.noLapSeconds = Math.round(Sound.bounded(e.target.value, 30, 5, 600)); e.target.value = d.noLapSeconds; step(); };
  if ($('au-battlelaps')) $('au-battlelaps').onchange = e => { d.battleLaps = Math.round(Sound.bounded(e.target.value, 3, 2, 20)); e.target.value = d.battleLaps; step(); };
  if ($('au-pause')) $('au-pause').onchange = e => { const n = Number(e.target.value); d.preDelay = Number.isFinite(n) && e.target.value !== '' ? Math.max(0, Math.min(10, n)) : 1; e.target.value = d.preDelay; step(); };
  if ($('au-ambvol')) $('au-ambvol').onchange = e => { const raw = String(e.target.value).trim(), n = Number(raw.replace(',', '.')); if (raw === '' || !Number.isFinite(n)) { e.target.value = Math.round(Sound.ambientOf(d).volume * 100); return; } d.ambVolume = Math.max(0, Math.min(100, n)) / 100; e.target.value = Math.round(d.ambVolume * 100); step(); }; // (percent in the box, 0 to 1 in the set)
  if ($('au-ambduck')) $('au-ambduck').onchange = e => { d.ambDuck = e.target.checked; step(); return renderAudioSetEditor(box); };
  if ($('au-ambdlvl')) $('au-ambdlvl').onchange = e => { const raw = String(e.target.value).trim(), n = Number(raw.replace(',', '.')); if (raw === '' || !Number.isFinite(n)) { e.target.value = Math.round(Sound.ambientOf(d).level * 100); return; } d.ambDuckLevel = Math.round(Math.max(0, Math.min(100, n))); e.target.value = d.ambDuckLevel; step(); };
  if ($('au-ambmax')) $('au-ambmax').onchange = e => { d.ambMax = Math.round(Sound.bounded(e.target.value, 6, 1, 16)); e.target.value = d.ambMax; step(); };
  $('au-by').onchange = e => { d.driverBy = e.target.value; step(); };
  $('au-voicehelp').onclick = () => { audVoiceNote = !audVoiceNote; $('au-voicenote').hidden = !audVoiceNote; $('au-voicehelp').setAttribute('aria-expanded', String(audVoiceNote)); }; // (a click shows the answer; another click hides it)
  $('au-vreport').onclick = async () => { // what the app is offered and what Windows lists (voicereport.js asks Windows; this only reads)
    $('au-vbox').hidden = false; $('au-vtext').value = 'Asking Windows for its voices...'; $('au-vmsg').textContent = '';
    let host = null; try { host = await api.voiceReport(); } catch (e) { host = null; }
    $('au-vtext').value = Sound.reportText({ ua: typeof navigator !== 'undefined' ? navigator.userAgent : '', voices: Sound.voices().map(v => ({ name: v.name, lang: v.lang, localService: v.localService })), host });
  };
  $('au-vcopy').onclick = async () => { try { await navigator.clipboard.writeText($('au-vtext').value); $('au-vmsg').textContent = 'Copied.'; } catch (e) { $('au-vtext').select(); $('au-vmsg').textContent = 'Select the text and copy it (Ctrl+C).'; } };
  [['au-rate', 'rate', 0.5, 2], ['au-pitch', 'pitch', 0, 2], ['au-vol', 'volume', 0, 1]].forEach(([id, k, lo, hi]) => { $(id).onchange = e => { const raw = String(e.target.value).trim(); if (raw === '') { e.target.value = d[k]; return; } /* (an emptied box is not a 0: a volume of 0 would mute the set) */ const n = Number(raw.replace(',', '.')); d[k] = Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : 1; e.target.value = d[k]; step(); }; });
  let saving = false; // (a second click while the first is being written would add the set twice)
  $('au-save').onclick = async () => {
    if (saving) return;
    d.name = d.name.trim(); if (!d.name) return msg('Please give the set a name.');
    saving = true;
    try {
      U.hist.touch(); const token = U.hist.commit(), data = clone(d); // (the state that is written is the one the steps call saved)
      if (audEd.id) await api.update('audiosets', audEd.id, data); else { const row = await api.add('audiosets', data); audEd.id = row.id; }
      U.hist.markSaved(token); audEd.dirty = !U.hist.isClean(); msg('Saved.'); // (a change made while it was being written is not saved yet)
    } finally { saving = false; }
  };
  $('au-back').onclick = () => { if (audEd.dirty && !confirm('Discard your unsaved changes to this audio set?')) return; Sound.stop(); draftUndoEnd(audEd); audEd = null; renderAudioSets(box); };
  box.oninput = ev => { const t = ev.target; if (t.dataset.text) { ref(t.dataset.text).text = t.value; mark(); } };
  box.onclick = ev => {
    const b = ev.target.closest('button'); if (!b) return;
    const q = b.dataset;
    if (q.openall) { audOpen = q.openall === '1' ? new Set([...groups.map(x => x[0]), Announcer.AMBIENT_GROUP]) : new Set(); return renderAudioSetEditor(box); }
    if (q.addline) { d.calls[q.addline].lines.push({ text: '', file: '' }); step(); return renderAudioSetEditor(box); }
    if (q.delline) { const [id, n] = q.delline.split(':'); d.calls[id].lines.splice(Number(n), 1); [...audCond].filter(k => k.startsWith(id + ':')).forEach(k => audCond.delete(k)); step(); return renderAudioSetEditor(box); }
    if (q.nofile) { ref(q.nofile).file = ''; step(); return renderAudioSetEditor(box); }
    if (q.ambtest) { Sound.stop(); msg(Sound.ambientTest(d, q.ambtest.split(':')[0], ref(q.ambtest).file) ? '' : 'Add a sound file first.'); return; } // (an ambient file plays as it will in the race: with the volume of the set and of the sound)
    if (q.test) { const [id] = q.test.split(':'); // test this one sentence with example values
      Sound.stop(); msg(Sound.say({ ...d, calls: { [id]: { on: true, lines: [{ ...ref(q.test), only: undefined }] } } }, id, Announcer.SAMPLE) ? '' : 'This sentence is empty.'); }
  };
  box.onchange = async ev => {
    const t = ev.target;
    if (t.dataset.on) { d.calls[t.dataset.on].on = t.checked; step(); return renderAudioSetEditor(box); }
    if (t.dataset.cond && t.dataset.line) { // a condition of a sentence: empty (or 0, or no number) takes it away
      const [id, n] = t.dataset.line.split(':'), l = d.calls[id].lines[Number(n)], o = { ...(l.only || {}) }, k = t.dataset.cond, v = Number(t.value);
      if (k === 'driver') { if (t.value) o.driver = t.value; else delete o.driver; }
      else if (t.value === '' || !Number.isFinite(v) || v <= 0) delete o[k];
      else o[k] = k === 'top' ? Math.round(Sound.bounded(v, 1, 1, 99)) : Sound.bounded(v, 1, 0.1, k === 'time' ? 3600 : 600);
      if (Object.keys(o).length) l.only = o; else delete l.only;
      step(); return renderAudioSetEditor(box);
    }
    if (t.dataset.ambopt) { // an option of an ambient sound: volume (percent), start after (seconds), which cars, how close, stop at the pit exit; empty = the usual
      const [k, id] = t.dataset.ambopt.split(':'), cc = d.calls[id], v = Number(t.value), none = t.value === '' || !Number.isFinite(v);
      if (k === 'cut') { if (t.checked) delete cc.cut; else cc.cut = false; }
      else if (k === 'who') { if (t.value === 'leader' || t.value === 'close') cc.who = t.value; else { delete cc.who; delete cc.near; } }
      else if (k === 'vol') { if (none || v >= 100) delete cc.vol; else cc.vol = Math.round(Sound.bounded(v, 100, 0, 100)); }
      else if (k === 'delay') { if (none || v <= 0) delete cc.delay; else cc.delay = Sound.bounded(v, 0, 0, 30); }
      else if (k === 'near') { if (none || v <= 0) delete cc.near; else cc.near = Sound.bounded(v, 3, 0.1, 60); }
      step(); return renderAudioSetEditor(box);
    }
    if (t.dataset.cool) { // "not again within" (whole seconds, 1 to 3600; empty takes it away)
      const cc = d.calls[t.dataset.cool], v = Number(t.value);
      if (t.value === '' || !Number.isFinite(v) || v <= 0) delete cc.cooldown; else cc.cooldown = Math.round(Sound.bounded(v, 1, 1, 3600));
      step(); return renderAudioSetEditor(box);
    }
    if (t.dataset.coolfor) { const cc = d.calls[t.dataset.coolfor]; if (t.value === 'driver') cc.coolFor = 'driver'; else delete cc.coolFor; step(); return renderAudioSetEditor(box); }
    if (t.dataset.file && t.files && t.files[0]) {
      const f = t.files[0]; if (f.size > Sound.MAX_FILE) return msg(`That file is too big (${(f.size / 1e6).toFixed(1)} MB). The limit is ${Sound.MAX_FILE / 1e6} MB.`);
      const rd = new FileReader(); rd.onload = () => { ref(t.dataset.file).file = String(rd.result); step(); renderAudioSetEditor(box); }; rd.onerror = () => msg('Could not read that file.'); rd.readAsDataURL(f);
    }
  };
}
