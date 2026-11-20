// Presentation only. audioedit owns draft, undo, validation and save.
let audioView = { tab: 'mix', category: '', call: 'prerace', search: '', filter: 'all', profile: '', variations: {}, folders: {} };
const audioDefaults = () => Sound.defaultSet();
const audioSample = c => Object.fromEntries(AudioCalls.variablesFor(c).map(k => [k, Announcer.SAMPLE[k] ?? '']));
const audioAmbientTitle = c =>
  ({ ambcrowd: 'Race crowd', ambparaddock: 'Paddock ambience', ambrain: 'Rain ambience', ambdry: 'Dry-weather ambience' })[c.id] ||
  c.label.split(' (')[0].split(':')[0];
function audioPreview(box, d) {
  if (box.nodeType !== 1) return;
  box.querySelectorAll('[data-message-preview]').forEach(el => {
    const [id, n] = el.dataset.messagePreview.split(':'),
      c = Announcer.CALLS.find(x => x.id === id),
      line = d.calls[id]?.lines[Number(n)];
    if (!line || !c) return;
    const sample = audioSample(c),
      check = AudioCalls.inspect(line.text, c, sample),
      mode = line.mode || (line.file ? 'file' : 'text');
    // (2.4.0) only what helps: how a line with race values sounds, a value this call does not have, or a file that is still missing
    el.textContent =
      mode !== 'text' && !line.file
        ? 'Choose a sound file to hear this line.'
        : mode === 'file'
          ? ''
          : check.unknown.length
            ? 'This call does not know ' + check.unknown.map(k => '{' + k + '}').join(', ') + ': it will not be said.'
            : /{[^}]+}/.test(line.text || '')
              ? 'Sounds like: “' + Announcer.fill(line.text, sample) + '”'
              : '';
    el.hidden = !el.textContent;
    el.classList.toggle('audio-invalid', check.unknown.length > 0 && mode !== 'file');
  });
}
function audioFolder(key, title, note = '', open = true) {
  const el = document.createElement('details');
  el.className = 'audio-folder';
  el.dataset.audioFolder = key;
  el.open = audioView.folders?.[key] ?? open;
  el.innerHTML = `<summary><strong>${esc(title)}</strong><small>${esc(note)}</small></summary><div class="audio-folder-content"></div>`;
  el.ontoggle = () => {
    if (el.isConnected) (audioView.folders || (audioView.folders = {}))[key] = el.open;
  };
  return el;
}
const audioFolderBody = el => el.querySelector('.audio-folder-content');
function audioBalance(box, d) {
  const el = box.querySelector('[data-audio-balance]');
  if (!el) return;
  const a = Sound.ambientOf(d),
    calls = Math.round(d.volume * 100),
    normal = Math.round(a.volume * 100),
    retained = Math.round(a.level * 100),
    effective = Math.round(normal * (a.duck ? a.level : 1));
  el.innerHTML = `<strong>While a call plays</strong><small>Example with an individual sound at 100%</small><div class="audio-meter"><span>Calls</span><span><i style="width:${calls}%"></i></span><b>${calls}%</b></div><div class="audio-meter audio-meter-ambient"><span>Ambient</span><span><i style="width:${effective}%"></i></span><b>${effective}%</b></div><p>${a.duck ? `${normal}% ambient × ${retained}% retained = ${effective}%. Returns to ${normal}% after the call.` : `Ambient stays at ${normal}% while calls play.`}</p>`;
  box.querySelector('#au-call-volume-output').textContent = calls + '%';
}
function audioVariations(box, id) {
  const card = box.querySelector(`[data-audio-call="${id}"]`);
  if (!card) return;
  const lines = [...card.querySelectorAll('[data-audio-variation-body]')],
    view = audioView.variations || (audioView.variations = {}),
    n = Math.max(0, Math.min(Number(view[id]) || 0, lines.length - 1));
  view[id] = n;
  lines.forEach((el, i) => (el.hidden = i !== n));
  const select = card.querySelector('[data-audio-variation]');
  if (select) select.value = String(n);
}
function audioValueExample(box, select) {
  const el = box.querySelector(`[data-audio-value-example="${select.dataset.audioValue}"]`);
  if (el)
    el.textContent = select.value
      ? 'Example: ' + (Announcer.SAMPLE[select.value] ?? 'Depends on race data')
      : 'No values are available for this call.';
}
// (2.4.0) an icon for every subject of the race calls (the names of AudioCalls.category)
const AUDIO_CAT_ICONS = {
  'Start & session': 'flag',
  'Positions & battles': 'board',
  'Progress & milestones': 'timing',
  'Laps & records': 'star',
  'Fuel Systems': 'fuel',
  'Pits & Service Stop': 'garage',
  'Tyre Wear Systems': 'tyre',
  'Penalty Systems': 'penalty',
  'Flags & Safety Car': 'safetycar',
  'Timing hardware': 'bolt',
  'Results & championship': 'championship',
  'Weather Systems': 'weather',
  'Time Tokens': 'tokens',
  'Damage & failures': 'damage',
  'Endurance & driver swaps': 'users',
  'Race control': 'director',
  'Resource Systems': 'resources'
};
function audioStudio(box, d) {
  if (box.nodeType !== 1) return;
  const C = Announcer.CALLS,
    A = Announcer.AMBIENT;
  box.classList.add('audio-editor');
  const old = document.createElement('div');
  while (box.firstChild) old.appendChild(box.firstChild);
  const bars = old.querySelectorAll('.ed-bar'),
    head = bars[0],
    voice = bars[1],
    groups = [...old.querySelectorAll('.audgroup')];
  const shell = document.createElement('section');
  shell.className = 'audio-studio setuppage';
  // (2.4.0) the Pit Board on top; in the side list the subjects of the race with how many of their calls are on, then the ambient sounds and the voice
  const onCount = C.filter(c => (d.calls[c.id] || {}).on !== false).length,
    cats = [...new Set(C.map(c => AudioCalls.category(c)))],
    railItem = (attrs, icon, title, n) =>
      `<button type="button" class="audio-ri" ${attrs}>${Icons.svg(icon, { size: 16, stroke: 1.8 })}<span>${esc(title)}</span>${n ? `<b>${n}</b>` : ''}</button>`;
  shell.innerHTML = `${pitBoard({
    cls: 'audio-pitboard',
    back: 'Audio sets',
    backId: 'au-back',
    eyebrow: `Audio set · ${onCount} of ${C.length} calls on`,
    name: `<input type="text" class="pb-name" id="au-name" value="${esc(d.name)}" maxlength="40" aria-label="Name">`,
    msgId: 'au-msg',
    undoId: 'au-undo',
    redoId: 'au-redo',
    saveId: 'au-save',
    save: 'Save audio set'
  })}<div class="audio-layout"><nav class="audio-tabs audio-rail" aria-label="Audio set sections"><p class="audio-rl">On air</p>${railItem('data-audio-tab="mix"', 'say', 'The voice & presets', '')}${railItem('data-audio-tab="names"', 'driver', 'Driver names', String((typeof audDrivers !== 'undefined' ? audDrivers : []).length || ''))}<p class="audio-rl">Race calls</p>${cats
    .map(g => {
      const list = C.filter(c => AudioCalls.category(c) === g);
      return railItem(
        `data-audio-category="${esc(g)}" data-audio-cattab="calls"`,
        AUDIO_CAT_ICONS[g] || 'say',
        g,
        `${list.filter(c => (d.calls[c.id] || {}).on !== false).length}/${list.length}`
      );
    })
    .join(
      ''
    )}<p class="audio-rl">Sound</p>${railItem('data-audio-tab="ambient"', 'wind', 'Ambient sounds', String(A.filter(c => ((d.calls[c.id] || {}).lines || []).some(l => l && l.file)).length))}<aside><strong>Use this audio set</strong><p>Choose it in Race Setup → Race UI and Audio. Sound plays on the computer running the race.</p></aside></nav><main class="audio-workspace"><div class="audio-plain"><small>IN PLAIN WORDS</small><p data-audio-explanation></p></div><div class="audio-columns"><div class="audio-finder"></div><div class="audio-main"><div class="audio-call-body"></div></div><div class="audio-tools"></div></div><section class="audio-mixer" hidden></section><section class="audio-names" hidden></section></main></div><footer class="audio-footer"></footer></section>`;
  box.appendChild(shell);
  const $ = s => shell.querySelector(s),
    mixer = $('.audio-mixer'),
    body = $('.audio-call-body');
  head.remove();
  groups.forEach(el => body.appendChild(el));
  // (2.4.0) one search over every call, quick filters, and all the calls of the subject as a list; a call opens under its row
  $('.audio-finder').innerHTML =
    `<label class="audio-search"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/></svg><input type="search" data-audio-search placeholder="Search the calls and their sentences (type {leader} for a variable)" aria-label="Search the calls" value="${esc(audioView.search)}"></label><div class="audio-chips" role="group" aria-label="Show">${[
      ['all', 'All'],
      ['on', 'On'],
      ['off', 'Off'],
      ['modified', 'Changed'],
      ['new', 'New']
    ]
      .map(
        ([v, t]) =>
          `<button type="button" class="audio-chip" data-audio-filterbtn="${v}" aria-pressed="${audioView.filter === v}">${t}</button>`
      )
      .join('')}</div><p class="audio-count" data-audio-count></p><div class="audio-calllist" role="list"></div>`;
  const tools = audioFolder('tools', 'Call presets & group actions', 'Only if you need them', false);
  audioFolderBody(tools).innerHTML =
    `<div data-call-presets><label>Starting preset<select id="au-profile"><option>Essential</option><option selected>Club</option><option>Broadcast</option></select></label><p>Changes which calls are enabled. Your messages and recordings are kept. Review before applying.</p><button class="btn" data-audio-profile="preview">Review preset changes</button><div id="au-profile-preview" role="status"></div><div class="audio-profile-actions" hidden><button class="btn" data-audio-profile="apply">Apply preset</button><button class="btn" data-audio-profile="cancel">Cancel</button></div></div><details><summary>Enable or disable the current category</summary><div class="row"><button class="btn" data-audio-enable="1">Enable category</button><button class="btn" data-audio-enable="0">Disable category</button></div></details>`;
  $('.audio-tools').appendChild(tools);
  const voiceFolder = audioFolder('voice', 'Commentator voice', 'How spoken messages sound'),
    balance = audioFolder('balance', 'Volume balance', 'Keep announcements clear'),
    timing = audioFolder('timing', 'Announcement timing', 'Keep commentary relevant', false);
  // (2.4.0, SlotForgeRestyle.md "Commentary Booth") the voice on air, the balance and the sample race beside it, then how much it says (the presets)
  const boothEl = document.createElement('div');
  boothEl.className = 'ab-booth';
  boothEl.innerHTML = `<section class="ab-air" aria-label="The voice"><span class="ab-onair"><i aria-hidden="true"></i>On air</span><h3>The voice</h3><p>How every call sounds. Type anything and hear it.</p><div class="ab-voice"></div><label class="ab-f ab-sink">Plays on<select id="au-sink" data-ab-sink><option value="">The speaker Windows uses</option></select><small>Sound files, recorded names and ambient sounds. The voice itself plays on the speaker Windows uses.</small></label><div class="ab-try"><input type="text" id="au-try" maxlength="200" value="${esc(audioView.tryText || 'Anna takes the lead on lap 12!')}" aria-label="A sentence to hear"><button type="button" class="btn" data-ab-hear>▶ Hear it</button></div></section><div class="ab-side"><div class="ab-box ab-balance-box"></div><div class="ab-box"><h4>Hear the whole set</h4><button type="button" class="ab-sample" data-ab-sample><span class="big" aria-hidden="true">▶</span><span><b>Play a sample race</b><small>One minute: the start, a new leader, a fastest lap, a yellow flag, the finish. With your voice, names and sounds.</small></span></button></div></div>`;
  const presetsEl = document.createElement('div');
  presetsEl.className = 'ab-presetbox';
  presetsEl.innerHTML = `<div class="ab-h"><h3>How much it says</h3><span>Start from a preset; your own sentences and recordings stay.</span></div><div data-ab-presets></div>`;
  mixer.append(boothEl, presetsEl, balance, timing);
  const sampleEl = document.createElement('section');
  sampleEl.className = 'ab-samplebox';
  sampleEl.hidden = true;
  sampleEl.dataset.abSamplebox = '';
  mixer.prepend(sampleEl);
  // the preset choice under the cards (the cards choose; Review and Apply stay as they were)
  const presetTools = tools.querySelector('[data-call-presets]');
  if (presetTools) {
    presetTools.querySelector('label').hidden = true;
    const review = presetTools.querySelector('[data-audio-profile="preview"]');
    if (review) review.hidden = true;
    presetsEl.appendChild(presetTools);
  }
  const toolsTitle = tools.querySelector('summary strong');
  if (toolsTitle) toolsTitle.textContent = 'Group actions & help';
  const volume = voice.querySelector('#au-vol').closest('label');
  volume.firstChild.textContent = 'Calls volume ';
  volume.querySelector('input').type = 'range';
  volume.querySelector('input').step = '0.01';
  volume.insertAdjacentHTML('beforeend', '<output id="au-call-volume-output"></output><small>Spoken messages and call recordings.</small>');
  boothEl.querySelector('.ab-voice').appendChild(voice);
  voice.className = 'audio-fields';
  for (const [id, label, note] of [
    ['au-rate', 'Speech speed', '1.0 = normal speed'],
    ['au-pitch', 'Voice pitch', '1.0 = normal pitch'],
    ['au-by', 'Call drivers by', '']
  ]) {
    const el = voice.querySelector('#' + id).closest('label');
    el.firstChild.textContent = label + ' ';
    if (note) el.insertAdjacentHTML('beforeend', `<small>${note}</small>`);
  }
  const voiceHelp = audioFolder('voice-help', 'Voice help & report', 'Missing a voice?', false);
  boothEl.querySelector('.ab-air').appendChild(voiceHelp);
  ['au-voicehelp', 'au-vreport', 'au-voicenote', 'au-vbox'].forEach(id => {
    const el = old.querySelector('#' + id) || voice.querySelector('#' + id);
    if (el) audioFolderBody(voiceHelp).appendChild(el);
  });
  voiceFolder.remove();
  const ambControls = body.querySelector('.ambintro'),
    ambFields = ambControls.querySelector('.ambset');
  const relabel = (id, text, note = '') => {
    const input = ambFields.querySelector('#' + id),
      label = input.closest('label');
    if (input.type === 'checkbox') {
      [...label.childNodes].filter(n => n.nodeType === 3).forEach(n => n.remove());
      label.append(document.createTextNode(text));
    } else label.firstChild.textContent = text + ' ';
    if (note) label.insertAdjacentHTML('beforeend', `<small>${note}</small>`);
    return label;
  };
  relabel('au-ambvol', 'Ambient volume (%)', 'Crowd, track and pit sound effects.');
  relabel('au-ambduck', 'Lower ambient sounds while a call plays');
  relabel('au-ambdlvl', 'Keep this much of their normal volume (%)');
  const max = relabel('au-ambmax', 'Maximum one-shot effects playing together', 'Background loops do not use these slots.'),
    maxFolder = audioFolder('max-effects', 'Simultaneous sound effects', 'Only if you need it', false);
  audioFolderBody(maxFolder).appendChild(max);
  ambFields.prepend(volume);
  ambFields.className = 'audio-fields';
  audioFolderBody(balance).appendChild(ambFields);
  boothEl.querySelector('.ab-balance-box').insertAdjacentHTML('beforeend', '<div class="audio-balance" data-audio-balance></div>');
  audioFolderBody(balance).appendChild(maxFolder);
  ambControls.remove();
  audioFolderBody(timing).innerHTML =
    `<div class="audio-fields"><label>Lap-time decimals<select data-audio-setting="spokenDecimals"><option value="2"${Number(d.spokenDecimals) !== 3 ? ' selected' : ''}>2 decimals</option><option value="3"${Number(d.spokenDecimals) === 3 ? ' selected' : ''}>3 decimals</option></select></label><label>Skip commentary waiting longer than (seconds)<input type="number" data-audio-setting="queueAge" min="0" max="120" value="${esc(d.queueAge ?? 12)}"><small>0 = keep waiting without expiry.</small></label></div><p>Flag, start and session-end calls interrupt ordinary commentary. Race-control and result calls do not expire. These are playback rules, not changes to race timing.</p>`;
  const help = old.querySelector('.audhelp');
  help.open = false;
  audioFolderBody(tools).appendChild(help);
  const log = audioFolder('diagnostics', 'Playback diagnostics', 'Why was a call skipped?', false);
  audioFolderBody(log).innerHTML =
    '<button class="btn" data-audio-diagnostics="1">Refresh recent decisions</button><pre id="au-diagnostics"></pre>';
  mixer.appendChild(log);
  // (2.4.0, SlotForgeRestyle.md "Cue Card") every call as one card that reads from top to bottom: when it plays (and its settings), what it says (every line at
  // once, each with ▶ to hear it and ⋯ for how it plays, Only when…, Delete), the race values as chips under the line you type in, then one more line and
  // the repeat limit. The nodes are the ones audioedit drew: its handlers stay as they are.
  const MODES = [
    ['text', 'Say it', 'The commentator voice says the line'],
    ['file', 'Play a sound file', 'Your own recording instead of the voice'],
    ['both', 'Sound file, then say it', 'Your recording first, then the voice']
  ];
  [...C, ...A].forEach(c => {
    const ambient = !!c.section,
      enable = body.querySelector(`[data-on="${c.id}"]`),
      card = enable.closest('fieldset'),
      inner = card.querySelector(':scope > div');
    card.dataset.audioCall = c.id;
    card.dataset.system = audioSystemTone(ambient ? c.section : AudioCalls.category(c));
    card.classList.add('cue');
    inner.hidden = false;
    const legend = card.querySelector('legend');
    legend.textContent = ambient ? audioAmbientTitle(c) : AudioCalls.title(c);
    const toggle = document.createElement('label');
    toggle.className = 'audio-enable';
    toggle.append(enable, document.createTextNode(ambient ? 'Enable this sound' : 'Enable this call'));
    card.insertBefore(toggle, inner);
    const existing = [...inner.children];
    // ---- when it plays ----
    const when = document.createElement('div');
    when.className = 'cue-when';
    when.innerHTML = `<span class="cue-k">${ambient ? 'Plays' : 'Plays when'}</span><p>${esc(ambient ? c.label + (c.loop ? ' (plays on and on until it ends)' : '') : c.label)}</p>`;
    const opts = document.createElement('div');
    opts.className = 'cue-opts';
    if (!ambient) opts.innerHTML = audioTrigger(c, d);
    existing
      .filter(el => !el.matches('.audline,.audcond,.audcool') && !el.querySelector('[data-addline]'))
      .forEach(el => opts.appendChild(el));
    if (opts.children.length) when.appendChild(opts);
    // ---- what it says ----
    const says = document.createElement('div');
    says.className = 'cue-says';
    says.innerHTML = `<span class="cue-k">${ambient ? 'Sound files' : 'What it says'}</span>`;
    const lines = existing.filter(el => el.matches('.audline')),
      vars = ambient ? [] : AudioCalls.variablesFor(c),
      own = ambient ? [] : c.vars.filter(k => vars.includes(k));
    lines.forEach((line, n) => {
      const key = c.id + ':' + n,
        record = d.calls[c.id].lines[n],
        mode = ambient ? 'file' : record.mode || (record.file ? 'file' : 'text'),
        row = document.createElement('div');
      row.className = 'cue-line';
      row.dataset.mode = mode;
      row.dataset.audioVariationBody = key; // (kept: the place of a line for audioedit)
      const test = line.querySelector('[data-test],[data-ambtest]'),
        input = line.querySelector('[data-text]'),
        file = line.querySelector('.audfile'),
        remove = line.querySelector('[data-delline]');
      test.className = 'btn icon cue-play';
      test.title = ambient ? 'Hear this sound' : 'Hear this line';
      test.setAttribute('aria-label', test.title);
      test.innerHTML =
        '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M7 5l12 7-12 7z" fill="currentColor"/></svg>';
      const main = document.createElement('div');
      main.className = 'cue-main';
      if (input) {
        input.placeholder = 'What the commentator says';
        input.hidden = mode === 'file';
        main.appendChild(input);
      }
      if (file) {
        file.classList.add('cue-file');
        file.hidden = mode === 'text';
        const pick = file.querySelector('[data-file]');
        if (pick) {
          // a quiet "Choose a sound file" button over the file field
          const lab = document.createElement('label');
          lab.className = 'btn sm ghost cue-pick';
          lab.textContent = record.file ? 'Replace the file' : 'Choose a sound file…';
          pick.before(lab);
          lab.appendChild(pick);
        } else if (record.file) {
          const tag = file.querySelector('.muted');
          if (tag)
            tag.outerHTML = `<span class="cue-filename">${Icons.svg('say', { size: 13, stroke: 1.8 })}${esc(record.fileName || 'Sound file')}</span>`;
          const nofile = file.querySelector('[data-nofile]');
          if (nofile) {
            nofile.className = 'btn sm ghost';
            nofile.textContent = 'Remove';
          }
        }
        main.appendChild(file);
      }
      if (!ambient) {
        main.insertAdjacentHTML('beforeend', `<p class="cue-example" data-message-preview="${key}" aria-live="polite"></p>`);
        if (vars.length)
          main.insertAdjacentHTML(
            'beforeend',
            `<div class="cue-vars" role="group" aria-label="Race values"><span>Insert</span>${own
              .map(
                k =>
                  `<button type="button" class="cue-var" data-audio-insert="${key}:${k}" title="${esc(Announcer.VARS[k] || k)} · e.g. ${esc(String(Announcer.SAMPLE[k] ?? ''))}">{${esc(k)}}</button>`
              )
              .join(
                ''
              )}<label class="cue-more-vars"><select data-audio-value="${key}" aria-label="More race values">${vars.map(k => `<option value="${k}">{${k}} · ${esc(Announcer.VARS[k] || k)}</option>`).join('')}</select></label><button type="button" class="btn sm ghost" data-audio-insert-selected="${key}">Insert</button><small data-audio-value-example="${key}"></small></div>`
          );
      }
      const condition = existing.find(el => el.dataset.condKey === key);
      if (condition) {
        condition.classList.add('cue-only');
        const sum = condition.querySelector('summary');
        if (sum) sum.innerHTML = sum.innerHTML.replace('Conditions&hellip;', 'Only when…').replace('Conditions…', 'Only when…');
        main.appendChild(condition);
      }
      // ⋯ how it plays, and delete
      const more = document.createElement('details');
      more.className = 'cue-menu';
      more.innerHTML = `<summary class="btn icon" title="More for this line" aria-label="More for this line">⋯</summary><div class="cue-pop">${
        ambient
          ? ''
          : `<p class="cue-pophead">How it plays</p>${MODES.map(([v, t, s]) => `<label class="cue-radio"><input type="radio" name="mode-${key}" data-audio-mode="${key}" value="${v}"${mode === v ? ' checked' : ''}><span><b>${t}</b><small>${s}</small></span></label>`).join('')}<hr>`
      }</div>`;
      remove.className = 'btn sm danger';
      remove.textContent = ambient ? 'Delete this sound file' : 'Delete this line';
      more.querySelector('.cue-pop').appendChild(remove);
      row.append(test, main, more);
      says.appendChild(row);
    });
    const add = inner.querySelector('[data-addline]'),
      foot = document.createElement('div');
    foot.className = 'cue-add';
    add.className = 'btn sm ghost cue-addbtn';
    add.textContent = ambient ? '+ Add a sound file' : lines.length ? '+ Add another line' : '+ Add a line';
    foot.appendChild(add);
    const conds = (d.calls[c.id].lines || []).some(l => l && l.only && Object.keys(l.only).length);
    foot.insertAdjacentHTML(
      'beforeend',
      `<small>${lines.length > 1 ? `One ${ambient ? 'file' : 'line'} is picked at random each time, so the race does not sound the same.` : lines.length ? (ambient ? 'Add more files for variety.' : 'Add more lines for variety: one is picked at random each time.') : ambient ? 'Nothing plays until a file is added.' : 'Nothing is said until a line is added.'}${conds ? ' A line with “Only when” is used first when it matches.' : ''}</small>`
    );
    says.appendChild(foot);
    // the options of an ambient sound (volume, start after, played for…) under its files
    const ambOpts = inner.querySelector('.ambopts');
    if (ambOpts) {
      ambOpts.classList.add('cue-opts');
      says.appendChild(ambOpts);
    }
    card.append(when, says);
    const cool = inner.querySelector('.audcool');
    if (cool) {
      cool.classList.add('cue-cool');
      card.appendChild(cool);
    }
    inner.remove();
  });
  box.querySelectorAll('i[data-lucide]').forEach(el => {
    el.outerHTML = Icons.svg({ 'audio-lines': 'say', megaphone: 'say', waves: 'wind', 'sliders-horizontal': 'sliders' }[el.dataset.lucide]);
  });
  box.querySelectorAll('[data-audio-value]').forEach(el => audioValueExample(box, el));
  audioSelect(box, d);
  audioPreview(box, d);
  audioBalance(box, d);
}
function audioSelect(box, d) {
  if (box.nodeType !== 1) return;
  const v = audioView,
    ambient = v.tab === 'ambient',
    defs = ambient ? Announcer.AMBIENT : Announcer.CALLS,
    group = c => (ambient ? c.section : AudioCalls.category(c)),
    title = c => (ambient ? audioAmbientTitle(c) : AudioCalls.title(c)),
    groups = [...new Set(defs.map(group))],
    defaults = audioDefaults();
  if (!ambient && !groups.includes(v.category)) v.category = groups[0];
  const matches = c => {
    const cc = d.calls[c.id] || {},
      base = defaults.calls[c.id] || {},
      words = (cc.lines || []).map(l => (l && l.text) || '').join(' '),
      // (2.4.0) the variables a call may use are searched only when you type a brace ({leader}): nearly every call may use {leader}
      vars = v.search.includes('{') ? (ambient ? c.vars : AudioCalls.variablesFor(c)).map(k => '{' + k + '}').join(' ') : '';
    return (
      (!v.search || (title(c) + ' ' + c.label + ' ' + words + ' ' + vars).toLowerCase().includes(v.search.toLowerCase())) &&
      (v.filter === 'all' ||
        (v.filter === 'on' && cc.on !== false) ||
        (v.filter === 'off' && cc.on === false) ||
        (v.filter === 'new' && c.added) ||
        (v.filter === 'modified' && JSON.stringify(cc) !== JSON.stringify(base)))
    );
  };
  // (the ambient sounds are one list with their sections as headings; a search goes over every call, with the subjects as headings)
  const list = defs.filter(c => matches(c) && (v.search || ambient || group(c) === v.category));
  if (v.call && !list.some(c => c.id === v.call)) v.call = '';
  const body = box.querySelector('.audio-call-body'),
    listEl = box.querySelector('.audio-calllist');
  // the open call goes back to its place before the list is drawn again
  box.querySelectorAll('.audio-calllist .audcall').forEach(card => body && body.appendChild(card));
  const row = c => {
    const cc = d.calls[c.id] || {},
      lines = (cc.lines || []).filter(Boolean),
      first = lines.find(l => l.text && (l.mode || (l.file ? 'file' : 'text')) !== 'file'),
      files = lines.filter(l => l.file).length,
      on = cc.on !== false,
      open = v.call === c.id;
    const say = first ? `“${esc(first.text)}”` : files ? 'A recording' : esc(ambient ? 'No sound file yet' : c.label);
    const meta = ambient
      ? `${files} file${files === 1 ? '' : 's'}`
      : `${lines.length} line${lines.length === 1 ? '' : 's'}${files ? ' · ' + files + ' sound file' + (files === 1 ? '' : 's') : ''}`;
    return `<div class="audio-row${open ? ' open' : ''}${on ? '' : ' off'}" role="listitem" data-row="${c.id}"><label class="audio-sw" title="${on ? 'On: click to switch it off' : 'Off: click to switch it on'}"><input type="checkbox" data-audio-rowon="${c.id}"${on ? ' checked' : ''} aria-label="${esc(title(c))} on"><i></i></label><button type="button" class="audio-rowmain" data-audio-call="${c.id}" aria-expanded="${open}"><b>${esc(title(c))}</b><span>${say}</span></button><span class="audio-rowmeta">${meta}</span><button type="button" class="btn ghost icon sm" data-audio-rowtest="${c.id}" title="Hear it" aria-label="Hear ${esc(title(c))}"><svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M7 5l12 7-12 7z" fill="currentColor"/></svg></button></div>`;
  };
  let html = '',
    lastGroup = null;
  list.forEach(c => {
    if ((v.search || ambient) && group(c) !== lastGroup) {
      lastGroup = group(c);
      html += `<div class="audio-listhead">${esc(lastGroup)}</div>`;
    }
    html += row(c);
  });
  if (listEl)
    listEl.innerHTML = html || `<p class="audio-empty">No ${ambient ? 'sound events' : 'calls'} match. Try another word or filter.</p>`;
  // the open call, right under its row
  const card = v.call && box.querySelector(`.audcall[data-audio-call="${v.call}"]`),
    at = v.call && listEl && listEl.querySelector(`[data-row="${v.call}"]`);
  if (card && at) at.after(card);
  box.querySelectorAll('.audcall').forEach(el => (el.hidden = el.dataset.audioCall !== v.call));
  const count = box.querySelector('[data-audio-count]');
  if (count)
    count.textContent = `${list.length} ${ambient ? 'sound event' : 'call'}${list.length === 1 ? '' : 's'}${v.search ? ' in every subject' : ambient ? '' : ' in ' + v.category}${v.call ? '' : ' · click one to open it'}.`;
  box.querySelector('[data-audio-explanation]').textContent =
    v.tab === 'names'
      ? 'Write a name as it sounds when the voice says it wrong (Byorn for Bjorn), or record it. A recording plays wherever the name is said.'
      : v.tab === 'mix'
        ? "Choose the commentator's voice and how much it says. Hear a sentence, or the whole set in a sample race."
        : ambient
          ? 'Add your own crowd, engine and pit sounds. They play alongside calls on a separate audio channel. Events without an attached file stay silent.'
          : 'Switch the calls of this subject on or off, and click a call to change what it says and when.';
  box.querySelectorAll('.audgroup').forEach(el => {
    el.open = true;
    el.hidden = ambient ? el.dataset.group !== Announcer.AMBIENT_GROUP : el.dataset.group === Announcer.AMBIENT_GROUP;
    el.querySelector(':scope > summary').hidden = true;
  });
  box.querySelectorAll('.ambsection').forEach(el => {
    el.open = true;
    el.querySelector('summary').hidden = true;
  });
  box.querySelectorAll('[data-audio-tab]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.audioTab === v.tab)));
  box
    .querySelectorAll('[data-audio-category]')
    .forEach(b => b.setAttribute('aria-pressed', String(v.tab === 'calls' && b.dataset.audioCategory === v.category)));
  box
    .querySelectorAll('[data-audio-filterbtn]')
    .forEach(b => b.setAttribute('aria-pressed', String(b.dataset.audioFilterbtn === v.filter)));
  box.querySelector('.audio-columns').hidden = v.tab === 'mix' || v.tab === 'names';
  box.querySelector('.audio-mixer').hidden = v.tab !== 'mix';
  // (2.4.0, "Commentary Booth") the presets as cards, and the names of the drivers
  const cards = box.querySelector('[data-ab-presets]');
  if (cards && typeof AudioBooth !== 'undefined')
    cards.innerHTML = AudioBooth.presetCardsHtml(
      AudioBooth.presets(
        d,
        Sound.profile,
        Announcer.CALLS.map(c => c.id)
      )
    );
  const names = box.querySelector('.audio-names');
  if (names) {
    names.hidden = v.tab !== 'names';
    if (v.tab === 'names' && typeof AudioBooth !== 'undefined')
      names.innerHTML = `<div class="ab-h"><h3>Driver names</h3><span>How the voice says each driver. Write it as it sounds, or record it.</span></div>${AudioBooth.namesHtml(
        typeof audDrivers !== 'undefined' ? audDrivers : [],
        d.names || {},
        {
          helmet: dr => (typeof Garage !== 'undefined' ? `<img src="avatars/Lane${Garage.helmetOf(dr)}.png" alt="">` : '<span></span>')
        }
      )}`;
  }
  const presets = box.querySelector('[data-call-presets]');
  if (presets) presets.hidden = ambient;
}

function audioTrigger(c, d) {
  const field = (key, label, note = '') => {
    const [v, lo, hi] = AudioCalls.SETTINGS[key];
    return `<label>${label}<input type="number" data-audio-setting="${key}" min="${lo}" max="${hi}" step="${['fuelRange', 'paceHysteresis'].includes(key) ? 0.1 : 1}" value="${esc(d[key] ?? v)}">${note ? '<small>' + note + '</small>' : ''}</label>`;
  };
  let html = '';
  if (c.id === 'fuellow')
    html =
      field('fuelLow', 'Fuel warning at (%)') +
      field('fuelReset', 'Allow another warning above (%)', 'Must exceed the warning threshold. Uses this car’s effective tank.');
  if (['fuelrange', 'fuelfinish'].includes(c.id))
    html =
      field('fuelRange', 'Low estimated range (laps)') +
      field('fuelSamples', 'Recent clean laps to average', 'At least 3 clean samples are needed before estimating range.');
  if (c.id === 'battle')
    html = `<label>Gap below (seconds)<input type="number" data-audio-setting="closeGap" min="0.1" max="30" step="0.1" value="${esc(d.closeGap ?? 1)}"><small>Shared with Closing in.</small></label>`;
  if (['pushstate', 'savestate', 'normalstate'].includes(c.id))
    html =
      field('paceLaps', 'Consecutive laps in the new state') +
      field(
        'paceHysteresis',
        'Normal pace band (±%)',
        'Small changes inside this band are Normal; consecutive laps and repeat limits prevent chatter.'
      );
  if (['laptime', 'racesummary', 'mandatorydue'].includes(c.id))
    html =
      field('summaryEvery', 'Every N completed laps') +
      (c.id === 'racesummary'
        ? `<label>Automatic summary<select data-audio-setting="summaryMode"><option value="laps"${d.summaryMode !== 'time' ? ' selected' : ''}>Every N laps</option><option value="time"${d.summaryMode === 'time' ? ' selected' : ''}>Every N seconds</option></select></label>` +
          field('summarySeconds', 'Seconds between summaries')
        : '');
  if (c.id === 'servicecountdown')
    html = `<label>Announce at remaining seconds<input data-audio-setting="serviceCountdown" value="${esc(d.serviceCountdown ?? '10,5')}"><small>Comma-separated, e.g. 10, 5. Includes additive penalty time.</small></label>`;
  if (c.id === 'serviceready')
    html =
      '<p>Timer mode: announced when the timer releases the car. Driver mode: announced when the car has been returned to the sensor and can drive off. Pit-exit holds suppress readiness. This confirms permission to leave, not completion of every service job. Manual mode waits for the Race Director.</p>';
  return html ? '<div class="audio-fields">' + html + '</div>' : '';
}
