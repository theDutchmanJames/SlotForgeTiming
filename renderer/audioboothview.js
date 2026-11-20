// The Commentary Booth of the audio set editor (2.4.0, SlotForgeRestyle.md "Commentary Booth"): what its buttons do. The speaker it plays on, a sentence to
// hear, the presets as cards, how every driver's name is said (written as it sounds, recorded, or a sound file), and a sample race. The editor's draft, undo
// and save stay in audioedit.js; the words and markup are made by audiobooth.js. Uses the page's globals (Sound, Announcer, audioView, audDrivers, esc).
let audBooth = null; // { box, d, mark, step, redraw }: the editor that is drawn now
let audSample = null; // the sample race that plays: { stop() }
let audRec = null; // the name that is being recorded: { id, recorder, stream, timer }
function audioBoothWire(box, d, mark, step, redraw) {
  audBooth = { box, d, mark, step, redraw };
  audioBoothSpeakers(box, d);
  if (box.__abWired) return;
  box.__abWired = true;
  box.addEventListener('click', ev => audioBoothClick(ev));
  box.addEventListener('input', ev => audioBoothInput(ev));
  box.addEventListener('change', ev => audioBoothChange(ev));
}
// the speakers of this computer (their names are shown once the app may use a microphone or has played sound; else "Speaker 1, 2…")
async function audioBoothSpeakers(box, d) {
  const sel = box.querySelector('[data-ab-sink]');
  if (!sel || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
  try {
    const outs = (await navigator.mediaDevices.enumerateDevices()).filter(
      x => x.kind === 'audiooutput' && x.deviceId && x.deviceId !== 'default'
    );
    sel.innerHTML =
      '<option value="">The speaker Windows uses</option>' +
      outs
        .map(
          (x, i) =>
            `<option value="${esc(x.deviceId)}"${x.deviceId === d.sink ? ' selected' : ''}>${esc(x.label || 'Speaker ' + (i + 1))}</option>`
        )
        .join('') +
      (d.sink && !outs.some(x => x.deviceId === d.sink)
        ? `<option value="${esc(d.sink)}" selected>A speaker that is not connected now</option>`
        : '');
  } catch (e) {
    /* the list stays with the Windows speaker */
  }
}
// say one sentence with the set's voice (and its names)
function audioBoothSay(d, text) {
  Sound.stop();
  Sound.say({ ...d, calls: { prerace: { on: true, lines: [{ text, mode: 'text' }] } } }, 'prerace', {});
}
const audioDriverOf = id => (typeof audDrivers !== 'undefined' ? audDrivers : []).find(x => x.id === id) || { id, name: '' };
function audioNameSet(id, patch) {
  const b = audBooth,
    d = b.d;
  d.names = d.names || {};
  const n = { ...(d.names[id] || {}), name: audioDriverOf(id).name || '', ...patch };
  if (!String(n.say || '').trim()) delete n.say;
  if (!n.file) {
    delete n.file;
    delete n.fileName;
  }
  if (n.say || n.file) d.names[id] = n;
  else delete d.names[id];
}
async function audioBoothClick(ev) {
  const b = audBooth;
  if (!b) return;
  const t = ev.target.closest('button');
  if (!t) return;
  const q = t.dataset,
    d = b.d;
  if (q.audioPreset) {
    const sel = b.box.querySelector('#au-profile'),
      review = b.box.querySelector('[data-audio-profile="preview"]');
    if (sel && review) {
      sel.value = q.audioPreset;
      review.click();
      b.box.querySelector('#au-profile-preview')?.scrollIntoView({ block: 'nearest' });
    }
    return;
  }
  if (q.abHear !== undefined) return audioBoothSay(d, (b.box.querySelector('#au-try') || {}).value || 'Welcome to SlotForge.');
  if (q.abSample !== undefined) return audioSampleRace(b.box, d);
  if (q.abSampleStop !== undefined) {
    if (audSample) audSample.stop();
    return;
  }
  if (q.namePlay) return audioBoothSay(d, AudioBooth.spoken(d.names, q.namePlay, audioDriverOf(q.namePlay).name || ''));
  if (q.nameClear) {
    audioNameSet(q.nameClear, { file: '' });
    b.step();
    return audioSelect(b.box, d);
  }
  if (q.nameRecord) return audioRecordName(q.nameRecord, t);
}
function audioBoothInput(ev) {
  const b = audBooth,
    t = ev.target;
  if (!b) return;
  if (t.id === 'au-try') audioView.tryText = t.value;
  if (t.dataset && t.dataset.nameSay) {
    audioNameSet(t.dataset.nameSay, { say: t.value });
    b.mark();
  }
}
function audioBoothChange(ev) {
  const b = audBooth,
    t = ev.target;
  if (!b) return;
  if (t.dataset && t.dataset.abSink !== undefined) {
    b.d.sink = t.value;
    Sound.sink(t.value);
    b.step();
    return;
  }
  if (t.dataset && t.dataset.nameFile && t.files && t.files[0]) {
    const f = t.files[0],
      id = t.dataset.nameFile;
    if (f.size > Sound.MAX_FILE) return Dialog.alert(`That file is too big (${(f.size / 1e6).toFixed(1)} MB).`);
    const rd = new FileReader();
    rd.onload = () => {
      audioNameSet(id, { file: String(rd.result), fileName: f.name });
      b.step();
      audioSelect(b.box, b.d);
    };
    rd.readAsDataURL(f);
  }
}
// record a name with the microphone: Record starts it, the same button (Stop) ends it; at most 4 seconds
async function audioRecordName(id, btn) {
  if (audRec) {
    const same = audRec.id === id;
    clearTimeout(audRec.timer);
    if (audRec.recorder.state !== 'inactive') audRec.recorder.stop();
    if (same) return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined')
    return Dialog.alert('This computer cannot record here. Choose a sound file of the name instead (File…).');
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    return Dialog.alert('The microphone could not be used: ' + (e && e.message ? e.message : e));
  }
  const recorder = new MediaRecorder(stream),
    parts = [];
  audRec = { id, recorder, stream, timer: 0 };
  btn.textContent = '■ Stop';
  btn.classList.add('rec-on');
  recorder.ondataavailable = e => e.data && e.data.size && parts.push(e.data);
  recorder.onstop = () => {
    stream.getTracks().forEach(tr => tr.stop());
    audRec = null;
    const blob = new Blob(parts, { type: recorder.mimeType || 'audio/webm' });
    if (!blob.size) return audioSelect(audBooth.box, audBooth.d);
    const rd = new FileReader();
    rd.onload = () => {
      audioNameSet(id, { file: String(rd.result), fileName: 'Recorded name' });
      audBooth.step();
      audioSelect(audBooth.box, audBooth.d);
    };
    rd.readAsDataURL(blob);
  };
  recorder.start();
  audRec.timer = setTimeout(() => recorder.state !== 'inactive' && recorder.stop(), 4000);
}
// the sample race: the set from the start to the winner, one call after the other, with what was said
function audioSampleRace(box, d) {
  if (audSample) audSample.stop();
  const el = box.querySelector('[data-ab-samplebox]');
  if (!el) return;
  const drivers = (typeof audDrivers !== 'undefined' ? audDrivers : []).filter(x => x.driverType !== 'virtual').slice(0, 4),
    steps = AudioBooth.sampleRace(drivers, { names: d.names || {} }),
    said = {};
  let i = 0,
    stopped = false,
    timer = 0;
  const draw = () => {
    el.hidden = false;
    el.innerHTML = `<div class="ab-h"><h3>Sample race${stopped ? '' : ' · playing'}</h3><span>${esc(drivers.map(x => x.name).join(', ') || 'Alex, Sam, Kim and Jo')} · your voice and sounds</span></div><div class="ab-prog"><i style="width:${Math.round((100 * i) / steps.length)}%"></i></div>${AudioBooth.sampleHtml(
      steps,
      0,
      said,
      {
        foot: `<div class="ab-sfoot">${stopped ? '<button type="button" class="btn" data-ab-sample>Play it again</button>' : '<button type="button" class="btn" data-ab-sample-stop>Stop</button>'}</div>`
      }
    )}`;
  };
  const next = () => {
    if (stopped) return;
    if (i >= steps.length) {
      stopped = true;
      audSample = null;
      return draw();
    }
    const s = steps[i];
    const owner =
      steps
        .slice(0, i + 1)
        .reverse()
        .find(x => x.title) || s; // (the countdown is one row: Start lights)
    said[owner.id] = 'now';
    const what = Sound.say(d, s.id, s.vars, Math.random, () => {
      if (stopped) return;
      said[owner.id] = true;
      i++;
      draw();
      timer = setTimeout(next, s.id.startsWith('countdown') ? 250 : 700);
    });
    if (!what) {
      if (owner === s) owner.off = true;
      said[owner.id] = owner.off ? '' : said[owner.id];
      i++;
      draw();
      timer = setTimeout(next, 150);
      return;
    }
    if (owner === s) s.text = AudioBooth.plainText(what.text || (what.file ? 'a sound file' : ''), d.names);
    else owner.text = (owner.text ? owner.text + ' · ' : '') + AudioBooth.plainText(what.text || '', d.names);
    draw();
  };
  audSample = {
    stop() {
      stopped = true;
      clearTimeout(timer);
      Sound.stop();
      audSample = null;
      draw();
    }
  };
  Sound.stop();
  draw();
  el.scrollIntoView({ block: 'nearest' });
  next();
}
// keep the place when the editor is drawn again: where it was scrolled to, and the field that had the cursor
function audioKeepPlace(draw) {
  const sc = document.getElementById('view') || document.scrollingElement,
    top = sc ? sc.scrollTop : 0,
    a = document.activeElement,
    key = a && (a.id || (a.dataset && (a.dataset.text || a.dataset.nameSay))),
    at = a && typeof a.selectionStart === 'number' ? a.selectionStart : null;
  draw();
  if (sc) sc.scrollTop = top;
  if (key) {
    const el =
      document.getElementById(key) || document.querySelector(`[data-text="${CSS.escape(key)}"],[data-name-say="${CSS.escape(key)}"]`);
    if (el && el !== document.activeElement) {
      el.focus({ preventScroll: true });
      if (at !== null && el.setSelectionRange) el.setSelectionRange(at, at);
    }
  }
}
