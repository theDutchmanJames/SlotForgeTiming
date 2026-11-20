// The setup guide (2.3.0): a fresh install walks through track → drivers → cars → timing hardware → sensor test → a 3-lap test race, instead of
// "Create a race setup in the Race Setup tab". Every step can be skipped, and so can the whole guide ("Skip the guide": it does not come back by itself).
// It shows on Home while no race setup exists and the guide was neither finished nor skipped; App Settings, General can start it again.
// Progress is kept in the setting setupGuide ({ step, trackId, driverIds, carIds }), so going to a hardware page to connect, or closing the app, comes back
// to the same step. 'done' / 'skipped': it is over.
// Pure part (tested without a screen): shouldShow, setupRecord, assignmentRows. render() draws a step into Home and uses the app's globals.
(function (root) {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const STEPS = [
    ['welcome', 'Welcome'],
    ['track', 'Your track'],
    ['drivers', 'Drivers'],
    ['cars', 'Cars'],
    ['hardware', 'Timing hardware'],
    ['sensors', 'Lanes & sensors'],
    ['audio', 'Commentary'], // (2.4.0)
    ['finish', 'Test race']
  ];
  // (2.4.0) the steps of a guide that was started before the Commentary step came: the test race moved one on
  const VERSION = 2;
  // (2.4.0) the commentary presets of the step (as in the Commentary Booth), with a sentence that shows how much each one says
  const PRESETS = [
    ['Essential', 'The start, the flags and the finish. Quiet for practice nights.', 'Anna wins the race!'],
    ['Club', 'Positions, fastest laps, records, pit stops and the last lap.', 'Anna takes the lead on lap 12!'],
    ['Broadcast', 'Everything, like TV: gaps, battles, pit stops and records.', 'Chris is three tenths behind Anna, and closing!']
  ];
  // (2.4.0) connect a port chosen in the guide: as the hardware page does
  const USE_PORT = { trackmate: p => tmUsePort(p), arduino: p => abUsePort(p), ds: p => dscUsePort(p) };
  const TEST_LAPS = 3;
  const HW_WORDS = {
    none: 'No hardware: you count laps with the keyboard, or let simulated cars drive.',
    trackmate: 'A Trackmate interface on a USB port.',
    arduino: 'An Arduino running the SlotForge sketch (lap sensors, pit sensors, lights and track power).',
    parallel: 'Sensors wired to a parallel port (LPT).',
    ds: 'A DS-200 or DS-300 lap counter on a serial or USB port.',
    plugin: 'Another interface, through a timing plugin.'
  };
  const VIRTUAL = { trackmate: () => tmUseVirtual(), arduino: () => abUseVirtual(), ds: () => dscUseVirtual() }; // (the virtual box of each, for this app session)

  // settings; counts: { setups } -> show the guide on Home?
  function shouldShow(settings, counts = {}) {
    const g = settings && settings.setupGuide;
    if (g === 'done' || g === 'skipped') return false;
    if (g && typeof g === 'object') return true;
    return !(counts.setups > 0);
  }
  const progressOf = settings => {
    const g = settings && settings.setupGuide;
    const ids = v => (Array.isArray(v) ? v.filter(x => typeof x === 'string' && x) : []);
    if (!(g && typeof g === 'object')) return { step: 0, trackId: '', driverIds: [], carIds: [] };
    let step = Math.floor(Number(g.step)) || 0;
    if (g.v !== VERSION && step >= 6) step++; // (a guide from before 2.4.0 that was at its test race)
    const a = g.audio && typeof g.audio === 'object' ? g.audio : null;
    return {
      step: Math.max(0, Math.min(STEPS.length - 1, step)),
      trackId: typeof g.trackId === 'string' ? g.trackId : '',
      driverIds: ids(g.driverIds),
      carIds: Array.isArray(g.carIds) ? g.carIds.map(x => (typeof x === 'string' ? x : '')) : [],
      ...(a
        ? {
            audio: {
              preset: PRESETS.some(x => x[0] === a.preset) ? a.preset : 'Club',
              voice: typeof a.voice === 'string' ? a.voice : '',
              setId: typeof a.setId === 'string' ? a.setId : '',
              own: typeof a.own === 'string' ? a.own : '',
              none: !!a.none
            }
          }
        : {})
    };
  };
  // the 3-lap test race: every setting at the value a new race setup starts with, a race over 3 laps on the track
  function setupRecord(schema, trackId) {
    const fields = (schema && schema.racesetups && schema.racesetups.fields) || [],
      r = {};
    fields.forEach(f => {
      if (f && f.key && !f.custom && f.default !== undefined) r[f.key] = Array.isArray(f.default) ? f.default.slice() : f.default;
    });
    return Object.assign(r, {
      name: `Test race (${TEST_LAPS} laps)`,
      sessionType: 'race',
      raceBy: 'laps',
      laps: TEST_LAPS,
      track: trackId
    });
  }
  // a driver (and a car) on every lane, in order; lanes without a driver stay empty
  function assignmentRows(lanes, driverIds, carIds) {
    return Array.from({ length: Math.max(0, lanes) }, (_, i) => ({
      driverId: driverIds[i] || '',
      carId: driverIds[i] ? carIds[i] || '' : ''
    })).filter(r => r.driverId);
  }
  // names typed in a list of boxes: trimmed, no empty ones, no name twice
  const namesOf = values => {
    const seen = new Set();
    return values.map(v => String(v || '').trim()).filter(v => v && !seen.has(v.toLocaleLowerCase()) && seen.add(v.toLocaleLowerCase()));
  };

  // ---- drawing (uses the app: api, state, render, setTimingHw, Hardware, SensorTest, TIMING_NAMES) ----
  let sensors = null; // the sensor test panel while it listens
  const stopSensors = () => {
    if (sensors) sensors.close();
    sensors = null;
  };
  async function save(patch) {
    state.settings = await api.setSettings(patch);
  }
  const keep = (p, more = {}) => save({ setupGuide: { ...p, ...more, v: VERSION } });
  let showHwCards = false; // (2.4.0) the hardware step: all interfaces as cards, or the big card of the chosen one
  async function finish(how) {
    stopSensors();
    await save({ setupGuide: how });
  }

  // view: the Home element; o: { tracks, drivers, cars } (the lists Home has read)
  async function draw(view, o = {}) {
    stopSensors();
    const S = state,
      p = progressOf(S.settings),
      step = STEPS[p.step][0],
      track = (o.tracks || []).find(t => t.id === p.trackId) || null,
      lanes = Math.max(1, Math.min(8, Math.floor(Number(track && track.lanes)) || 0)) || 0;
    // Start Lights (2.4.0): the steps as a gantry of lights that come on one by one, green at the test race
    const head = `<div class="wz-top"><span class="wz-eyebrow">Setup guide${p.step ? ` · step ${p.step} of ${STEPS.length - 1}` : ''}</span><div class="wz-steps${p.step === STEPS.length - 1 ? ' wz-go' : ''}" aria-label="Steps">${STEPS.map(
      ([, t], i) =>
        `<span class="wz-step${i === p.step ? ' wz-now' : i < p.step ? ' wz-done' : ''}"${i === p.step ? ' aria-current="step"' : ''}><i aria-hidden="true"></i><span>${i ? i + '. ' : ''}${esc(t)}</span></span>`
    ).join('')}</div></div>`;
    const nav = (next = 'Next', back = true, extra = '') =>
      `<div class="row wz-nav">${back && p.step > 0 ? '<button type="button" class="btn" data-wz="back">Back</button>' : ''}<span class="hm-grow"></span>${extra}<button type="button" class="btn wz-skip" data-wz="skip">Skip the guide</button><button type="button" class="btn primary" data-wz="next">${esc(next)}</button></div>`;
    const hue = i => (typeof HomeStats !== 'undefined' && HomeStats.laneColor ? HomeStats.laneColor(null, i) : '') || '#98a0ab';
    const laneTile = i => `<i class="wz-lane" style="--c:${esc(hue(i))}" aria-hidden="true">${i + 1}</i>`;
    const ico = (id, size = 18) => (typeof Icons !== 'undefined' && Icons.has && Icons.has(id) ? Icons.svg(id, { size }) : '');
    const HW_ICON = { none: 'car', trackmate: 'timing', arduino: 'bolt', parallel: 'parallel', ds: 'gauge', plugin: 'layers' };
    const STEP_ICON = ['', 'pin', 'users', 'car', 'bolt', 'check', '', 'flag'];
    let body = '';
    if (step === 'welcome')
      body = `<div class="wz-welcome"><div><h2>Let’s set up your first race</h2><p class="wz-lead">A few short steps: your track, the drivers and cars, the timing hardware, a check of every lane sensor, and a ${TEST_LAPS}-lap test race. It takes about five minutes.</p>
        <p class="muted">Every step can be skipped, and so can the whole guide: you can also set everything up yourself in the Database and Race Setup tabs. App Settings, General starts this guide again.</p></div>
        <ol class="wz-plan">${STEPS.slice(1)
          .map(([, t], i) => `<li><span class="wz-planico">${ico(STEP_ICON[i + 1])}</span><span>${esc(t)}</span></li>`)
          .join('')}</ol></div>
        <div class="row wz-nav"><span class="hm-grow"></span><button type="button" class="btn wz-skip" data-wz="skip">Skip the guide, I’ll set it up myself</button><button type="button" class="btn primary" data-wz="next">Start</button></div>`;
    else if (step === 'track') {
      const others = (o.tracks || []).filter(t => t.id !== p.trackId);
      body = `<h2>Your track</h2><p class="muted">The number of lanes decides how many cars race at once. The length is optional: with it the app shows speeds and distances.</p>
        ${
          others.length || track
            ? `<div class="field" style="max-width:420px"><label for="wz-trackpick">Track</label><select id="wz-trackpick"><option value="">A new track</option>${(o.tracks || []).map(t => `<option value="${esc(t.id)}"${t.id === p.trackId ? ' selected' : ''}>${esc(t.name || '(unnamed)')} · ${esc(t.lanes || '?')} lanes</option>`).join('')}</select></div>`
            : ''
        }
        <div id="wz-newtrack"${track ? ' hidden' : ''}><div class="field" style="max-width:420px"><label for="wz-tname">Name</label><input id="wz-tname" type="text" maxlength="60" placeholder="My track" value=""></div>
        <div class="row"><div class="field"><label for="wz-tlanes">Number of lanes</label><input id="wz-tlanes" type="number" min="1" max="8" step="1" value="4" style="width:6em"></div>
        <div class="field"><label for="wz-tlen">Length in metres (optional)</label><input id="wz-tlen" type="number" min="0" step="0.01" placeholder="for example 24.5" style="width:10em"></div></div></div>
        <p class="wz-msg muted" id="wz-msg" role="status"></p>${nav()}`;
    } else if (step === 'drivers') {
      const chosen = (o.drivers || []).filter(d => p.driverIds.includes(d.id)),
        n = Math.max(lanes || 2, 1);
      body = `<h2>Drivers</h2><p class="muted">One name per box: the first one drives in lane 1, and so on. You can add avatars, callsigns and more later in Database, Drivers.</p>
        ${chosen.length ? `<p>Already added: <b>${chosen.map(d => esc(d.name)).join(', ')}</b>. Add more below, or go on.</p><div class="wz-added" aria-hidden="true">${chosen.map((d, i) => `<span>${laneTile(i)}${esc(d.name)}</span>`).join('')}</div>` : ''}
        <div class="wz-names">${Array.from({ length: chosen.length ? Math.max(0, n - chosen.length) || 1 : n }, (_, i) => `<label class="wz-lanerow">${laneTile(chosen.length + i)}<input type="text" maxlength="40" data-wzname aria-label="Driver ${chosen.length + i + 1}" placeholder="Driver ${chosen.length + i + 1}"></label>`).join('')}</div>
        <p class="wz-msg muted" id="wz-msg" role="status"></p>${nav(chosen.length ? 'Next' : 'Add the drivers')}`;
    } else if (step === 'cars') {
      const drivers = p.driverIds.map(id => (o.drivers || []).find(d => d.id === id)).filter(Boolean);
      const library = api.libraryStatus ? await api.libraryStatus().catch(() => null) : null;
      if (library && library.available) {
        // (2.4.0) the cars of the shared library, chosen here for every driver
        const all = (await api.list('slotcars').catch(() => [])).filter(c => !c.retired && !(c.paddock && c.paddock.archived));
        const nameOf = c => [c.make || c.brand, c.model || c.name].filter(Boolean).join(' ') || c.name || 'Car';
        const opts = cur =>
          `<option value="">No car yet</option>${all
            .slice()
            .sort((x, y) => nameOf(x).localeCompare(nameOf(y)))
            .map(
              c =>
                `<option value="${esc(c.id)}"${c.id === cur ? ' selected' : ''}>${esc(nameOf(c))}${c.number ? ' · #' + esc(c.number) : ''}</option>`
            )
            .join('')}`;
        body = `<h2>Cars</h2><p class="muted">Choose a car for every driver from your shared library (SlotForge Paddock). You can change it on Home before every race.</p>
        <div class="wz-src"><i aria-hidden="true"></i>Shared library on this computer · <b>${all.length} ${all.length === 1 ? 'car' : 'cars'}</b><span>New cars are added in Paddock or Database › Slotcars</span></div>
        ${
          drivers.length
            ? `<div class="wz-carlist">${drivers.map((d, i) => `<label class="wz-carpick">${laneTile(i)}<b>${esc(d.name)}</b><select data-wzcarpick="${i}" aria-label="Car for ${esc(d.name)}">${opts(p.carIds[i] || '')}</select></label>`).join('')}</div>`
            : '<p class="muted">Add drivers first (step 2), then choose their cars here.</p>'
        }
        <p class="wz-msg muted" id="wz-msg" role="status"></p>${nav('Next')}`;
      } else
        body = `<h2>Cars</h2><p class="muted">Optional: give each driver a car, so the results and the statistics know which car drove. A name is enough, such as “Scalextric Porsche 911”. Pictures, motors and tyres can follow in Database, Slotcars.</p>
        ${drivers.length ? `<div class="wz-names">${drivers.map((d, i) => `<label class="wz-carrow">${laneTile(i)}<span>${esc(d.name)}</span><input type="text" maxlength="60" data-wzcar="${i}" placeholder="No car" value="${esc(((o.cars || []).find(c => c.id === p.carIds[i]) || {}).model || '')}"${p.carIds[i] ? ' disabled' : ''} aria-label="Car for ${esc(d.name)}"></label>`).join('')}</div>` : '<p class="muted">Add drivers first (step 2), then give them cars here.</p>'}
        <p class="wz-msg muted" id="wz-msg" role="status"></p>${nav('Next')}`;
    } else if (step === 'hardware') {
      const chosen = Hardware.timingChosen(S.settings),
        on = typeof timingConnectedNow === 'function' ? !!timingConnectedNow()[chosen] : false,
        name = TIMING_NAMES[chosen] || chosen;
      const cards = `<div class="wz-hw" role="radiogroup" aria-label="Timing hardware">${Hardware.TIMING.map(
        ([id, nm]) =>
          `<label class="wz-hwopt${id === chosen ? ' wz-on' : ''}"><input type="radio" name="wzhw" value="${id}"${id === chosen ? ' checked' : ''}><span class="wz-hwico">${ico(HW_ICON[id] || 'timing', 20)}</span><span><b>${esc(nm)}</b><small>${esc(HW_WORDS[id] || '')}</small></span></label>`
      ).join('')}</div>`;
      const remembered = { trackmate: 'tmDevice', arduino: 'abDevice', ds: 'dsDevice' }[chosen];
      const port = !!USE_PORT[chosen] && typeof navigator !== 'undefined' && !!navigator.serial;
      const how =
        chosen === 'trackmate'
          ? [
              'Plug the Trackmate into a USB port and switch it on.',
              'Choose its port: Windows lists it as USB Serial (COM3, COM4…).',
              'The guide sees it connect and goes on to the lanes.'
            ]
          : chosen === 'arduino'
            ? [
                'Plug the Arduino into a USB port (the SlotForge sketch on it).',
                'Choose its port: Windows lists it as USB Serial or Arduino (COM…).',
                'The guide sees it connect and goes on to the lanes.'
              ]
            : chosen === 'ds'
              ? [
                  'Connect the DS lap counter by its serial or USB cable.',
                  'Choose its port: Windows lists it as a COM port.',
                  'The guide sees it connect and goes on to the lanes.'
                ]
              : [
                  'Its pins, pit inputs and relays are set on its own page.',
                  'The pill at the bottom of that page brings you back here.',
                  'Then the guide goes on to the lanes.'
                ];
      body =
        chosen === 'none' || showHwCards
          ? `<h2>Timing hardware</h2><p class="muted">What counts the laps? Choose one; you can change it at any time in App Settings, Timing Hardware.</p>${cards}
        <p class="wz-msg muted" id="wz-msg" role="status"></p>${nav('Next')}`
          : `<h2>Timing hardware</h2><p class="muted">What counts the laps? Connect it here; the guide goes on when it is connected.</p>
        <div class="wz-hwcard${on ? ' wz-hwon' : ''}"><span class="wz-hwdev">${ico(HW_ICON[chosen] || 'timing', 30)}</span><div><span class="wz-k">${esc(name)}</span><h3>${on ? 'Connected' : remembered && S.settings[remembered] ? 'Connect it again' : 'Plug it in, then connect'}</h3><span class="wz-pill ${on ? 'wz-pon' : 'wz-poff'}"><i aria-hidden="true"></i>${on ? 'Connected' : 'Not connected'}</span></div><div class="wz-hwacts">${
          on
            ? '<button type="button" class="btn primary" data-wz="next">Next: the lanes</button>'
            : `${remembered && S.settings[remembered] ? '<button type="button" class="btn primary" data-wz="reconnect">Connect</button>' : ''}${port ? `<button type="button" class="btn${remembered && S.settings[remembered] ? '' : ' primary'}" data-wz="port">Choose its port…</button>` : `<button type="button" class="btn primary" data-wz="connect">Open its page</button>`}${VIRTUAL[chosen] ? '<button type="button" class="btn" data-wz="virtual">No hardware at hand: a virtual one</button>' : ''}`
        }</div></div>
        ${on ? '' : `<div class="wz-how">${how.map((t, i) => `<div><b>${i + 1}</b>${esc(t)}</div>`).join('')}</div>`}
        <p class="wz-other">Not a ${esc(name)}? <button type="button" class="wz-link" data-wz="pickhw">Choose another interface</button>${port ? ' · <button type="button" class="wz-link" data-wz="connect">Open its page</button> for more settings (the pill at the bottom brings you back).' : ''}</p>
        <p class="wz-msg muted" id="wz-msg" role="status"></p>${nav('Next')}`;
    } else if (step === 'sensors') {
      const hw = Hardware.timingChosen(S.settings);
      body = `<h2>Lanes &amp; sensors</h2><p class="muted">Drive a car over the line in lane 1, then lane 2, and so on. A lane that lights another lane's sensor is swapped in one click. Then the pit lane, the Track call button and the track power, if your hardware has them. Home has this test too (Test sensors).</p>
        <div id="wz-sensors"></div>${nav('Next')}`;
      view.innerHTML = `<section class="card wz-card">${head}${body}</section>`;
      sensors = SensorTest.mount(document.getElementById('wz-sensors'), {
        lanes: lanes || 2,
        hw,
        name: TIMING_NAMES[hw] || hw,
        settings: S.settings
      });
      bind(view, o, p, lanes);
      return;
    } else if (step === 'audio') {
      // (2.4.0) how much the voice says: a preset as an audio set for the test race, the voice, Hear it; or a set of your own; or none
      const A = p.audio || { preset: 'Club', voice: '', setId: '', own: '', none: false };
      const own = (await api.list('audiosets').catch(() => [])).filter(x => !(A.setId && x.id === A.setId));
      const voices = typeof speechSynthesis !== 'undefined' ? speechSynthesis.getVoices() : [];
      if (!voices.length && typeof speechSynthesis !== 'undefined' && !draw.waitVoices) {
        // (Windows gives the voices a moment after the start: the step is drawn again when they come)
        draw.waitVoices = true;
        speechSynthesis.addEventListener(
          'voiceschanged',
          () => {
            if (STEPS[progressOf(state.settings).step][0] === 'audio' && state.tab === 'home') render();
          },
          { once: true }
        );
      }
      const count = name => {
        try {
          const set = Sound.profile(Sound.defaultSet(), name);
          return Object.values(set.calls || {}).filter(c => c && c.on).length;
        } catch (e) {
          return 0;
        }
      };
      body = `<h2>Commentary</h2><p class="muted">How much the voice says during a race. You can change everything later in Customization › Audio sets.</p>
        <div class="wz-sets${A.none ? ' wz-dim' : ''}" role="radiogroup" aria-label="Commentary">${PRESETS.map(([n, t]) => {
          const sel = !A.none && !A.own && A.preset === n;
          return `<div class="wz-set${sel ? ' wz-on' : ''}"><button type="button" class="wz-setpick" role="radio" aria-checked="${sel}" data-wz="preset" data-wzpreset="${n}"><h4>${n}</h4><p>${esc(t)}</p><span class="wz-n">${count(n)} calls</span></button><button type="button" class="btn sm ghost" data-wz="hear" data-wzhear="${n}">▶ Hear it</button></div>`;
        }).join('')}</div>
        ${own.length ? `<label class="wz-own">Or one of your audio sets<select id="wz-ownset"><option value="">—</option>${own.map(x => `<option value="${esc(x.id)}"${A.own === x.id ? ' selected' : ''}>${esc(x.name || 'Audio set')}</option>`).join('')}</select></label>` : ''}
        <div class="wz-voice${A.none ? ' wz-dim' : ''}"><label>Voice<select id="wz-voice"><option value="">The voice Windows uses</option>${voices.map(v => `<option value="${esc(v.name)}"${A.voice === v.name ? ' selected' : ''}>${esc(v.name)}${v.lang ? ' · ' + esc(v.lang) : ''}</option>`).join('')}</select></label><label>A sentence<input id="wz-say" type="text" maxlength="200" value="Anna takes the lead on lap 12!"></label><button type="button" class="btn" data-wz="hear" data-wzhear="">▶ Hear it</button></div>
        <label class="wz-none"><input type="checkbox" id="wz-nocomm"${A.none ? ' checked' : ''}> No commentary for now</label>
        <p class="wz-msg muted" id="wz-msg" role="status"></p>${nav('Next')}`;
    } else if (step === 'finish')
      body = `<h2>Your test race</h2>${
        track
          ? `<div class="wz-ticket"><div><small>Track</small><b>${esc(track.name || 'My track')}</b></div><div><small>Laps</small><b>${TEST_LAPS}</b></div><div><small>Lanes</small><b>${lanes}</b></div><div><small>Commentary</small><b>${esc(p.audio ? (p.audio.none ? 'None' : p.audio.own ? 'Your set' : p.audio.preset) : 'None')}</b></div><div><small>Drivers</small><b>${p.driverIds.length || '–'}</b></div></div>`
          : ''
      }<p>The guide makes a race setup <b>Test race (${TEST_LAPS} laps)</b>${track ? ` on <b>${esc(track.name)}</b>` : ''} and puts ${p.driverIds.length ? 'the drivers on their lanes' : 'it on Home'}. Then press <b>Start race</b> on Home.</p>
        <p class="muted">Race setups (Race Setup tab) hold everything else: heats, fuel, pit stops, penalties, weather and more. Copy the test race there to make your own.</p>
        ${p.driverIds.length && p.driverIds.some((_, i) => !p.carIds[i]) ? '<p class="muted">Every lane needs a driver and a car: on Home, choose a car for the lanes that have none yet.</p>' : ''}
        ${track ? '' : '<p class="st-off">There is no track yet (step 1), so no race can be made. Go back, or finish and set it up yourself.</p>'}
        <p class="wz-msg muted" id="wz-msg" role="status"></p>${nav(track ? 'Make the test race' : 'Finish', true)}`;
    view.innerHTML = `<section class="card wz-card">${head}${body}</section>`;
    bind(view, o, p, lanes);
    const first = view.querySelector('input:not([disabled]),select');
    if (first && step !== 'hardware') first.focus();
  }

  const A_list = e => api.list(e).catch(() => []);
  const A_upd = (e, id, patch) => api.update(e, id, patch);
  function bind(view, o, p, lanes) {
    const S = state,
      A = api,
      step = STEPS[p.step][0],
      $ = id => document.getElementById(id),
      msg = t => {
        const m = $('wz-msg');
        if (m) m.textContent = t;
      },
      go = async (n, more = {}) => {
        await keep(p, { ...more, step: n });
        await render();
      };
    const pick = $('wz-trackpick');
    if (pick) pick.onchange = () => ($('wz-newtrack').hidden = !!pick.value);
    const audioNow = () => ({ ...(p.audio || { preset: 'Club', voice: '', setId: '', own: '', none: false }) });
    const keepAudio = async patch => {
      p.audio = { ...audioNow(), ...patch };
      await keep(p);
    };
    view.onchange = async ev => {
      const t = ev.target || {};
      if (t.id === 'wz-voice') return keepAudio({ voice: t.value });
      if (t.id === 'wz-ownset') {
        await keepAudio({ own: t.value, none: false });
        return render();
      }
      if (t.id === 'wz-nocomm') {
        await keepAudio({ none: !!t.checked });
        return render();
      }
      if (ev.target && ev.target.name === 'wzhw') {
        showHwCards = false;
        try {
          if ((await setTimingHw(ev.target.value)) === false) return;
        } catch (e) {
          msg(String(e && e.message ? e.message : e).replace(/^.*Error: /, '')); // (a race that is still open keeps its timing hardware)
          ev.target.checked = false;
          return;
        }
        await render();
      }
    };
    view.onclick = async ev => {
      const b = ev.target && ev.target.closest ? ev.target.closest('[data-wz]') : null;
      if (!b || b.disabled) return;
      const what = b.dataset.wz;
      if (what === 'skip') {
        const ok = await Dialog.confirm(
          'Skip the setup guide? It does not come back by itself; App Settings, General can start it again.\n\nWhat was already added (track, drivers, cars) stays.',
          { title: 'Skip the guide', ok: 'Skip the guide', cancel: 'Keep going' }
        );
        if (!ok) return;
        await finish('skipped');
        return render();
      }
      if (what === 'back') return go(p.step - 1);
      if (what === 'pickhw') {
        showHwCards = true;
        return render();
      }
      // (2.4.0) connect inside the guide: the remembered device, or a port chosen now; then on to the lanes
      if (what === 'reconnect' || what === 'port') {
        const hw = Hardware.timingChosen(S.settings);
        b.disabled = true;
        let ok = false;
        try {
          if (what === 'port') {
            const port = await navigator.serial.requestPort();
            ok = await USE_PORT[hw](port);
          } else if (typeof DESK_CONNECT !== 'undefined' && DESK_CONNECT[hw]) ok = await DESK_CONNECT[hw]();
        } catch (e) {
          if (!/No port selected|NotFoundError/i.test(String(e && (e.name || '') + ' ' + (e.message || ''))))
            msg('Could not connect: ' + (e && e.message ? e.message : e));
          if (b.isConnected) b.disabled = false;
          return;
        }
        await new Promise(r => setTimeout(r, 400));
        const on = typeof timingConnectedNow === 'function' && !!timingConnectedNow()[hw];
        if (on) return go(5);
        if (b.isConnected) b.disabled = false;
        msg(
          ok === false
            ? 'It did not answer on that port. Is it switched on? Choose its port again, or open its page.'
            : 'Not connected yet: choose its port, or open its page.'
        );
        return;
      }
      if (b.dataset.wzpreset) {
        await keepAudio({ preset: b.dataset.wzpreset, own: '', none: false });
        return render();
      }
      if (b.dataset.wzhear !== undefined) {
        const name = b.dataset.wzhear,
          A = audioNow(),
          text = name ? (PRESETS.find(x => x[0] === name) || [])[2] : ($('wz-say') || {}).value || 'Welcome to SlotForge.';
        try {
          const set = { ...Sound.profile(Sound.defaultSet(), name || A.preset), voice: ($('wz-voice') || {}).value || A.voice };
          Sound.stop();
          Sound.say({ ...set, calls: { prerace: { on: true, lines: [{ text, mode: 'text' }] } } }, 'prerace', {});
        } catch (e) {
          msg('The voice could not speak: ' + (e && e.message ? e.message : e));
        }
        return;
      }
      if (what === 'connect') {
        stopSensors();
        S.guideBack = { step: p.step, title: STEPS[p.step][1] }; // (2.4.0: the pill that brings you back)
        S.tab = 'settings';
        S.settingsSub = 'hardware';
        S.hwSub = Hardware.timingChosen(S.settings);
        return render();
      }
      if (what === 'virtual') {
        const hw = Hardware.timingChosen(S.settings);
        if (hw === 'ds' && !DsTiming.supported(S.settings.dsType)) await save({ dsType: 'ds300' });
        b.disabled = true;
        const ok = await VIRTUAL[hw]();
        if (!ok) msg('The virtual one could not be started. Open its page (App Settings, Timing Hardware) to see why.');
        else await render();
        return;
      }
      if (what !== 'next') return;
      b.disabled = true;
      try {
        if (step === 'welcome') return await go(1);
        if (step === 'track') {
          if (pick && pick.value) return await go(2, { trackId: pick.value });
          const name = $('wz-tname').value.trim() || 'My track',
            n = Math.floor(Number($('wz-tlanes').value)),
            len = Number($('wz-tlen').value);
          if (!(n >= 1 && n <= 8)) {
            msg('The number of lanes is 1 to 8.');
            return;
          }
          const row = await A.add('tracks', { name, lanes: n, ...(len > 0 ? { length: len } : {}) });
          return await go(2, { trackId: row.id });
        }
        if (step === 'drivers') {
          const known = new Set((o.drivers || []).map(d => String(d.name || '').toLocaleLowerCase()));
          const names = namesOf([...view.querySelectorAll('[data-wzname]')].map(i => i.value));
          const ids = p.driverIds.slice();
          for (const name of names) {
            const same = (o.drivers || []).find(d => String(d.name || '').toLocaleLowerCase() === name.toLocaleLowerCase());
            if (same && !ids.includes(same.id))
              ids.push(same.id); // (a driver who is already in the database is not made twice)
            else if (!known.has(name.toLocaleLowerCase())) ids.push((await A.add('drivers', { name })).id);
          }
          return await go(3, { driverIds: ids });
        }
        if (step === 'cars') {
          const carIds = p.carIds.slice();
          for (const sel of view.querySelectorAll('[data-wzcarpick]')) carIds[Number(sel.dataset.wzcarpick)] = sel.value; // (2.4.0: from the shared library)
          for (const input of view.querySelectorAll('[data-wzcar]')) {
            const i = Number(input.dataset.wzcar),
              name = input.value.trim();
            if (input.disabled || !name) continue;
            carIds[i] = (await A.add('slotcars', { model: name })).id;
          }
          return await go(4, { carIds });
        }
        if (step === 'hardware') {
          showHwCards = false;
          return await go(Hardware.timingChosen(S.settings) === 'none' ? 6 : 5);
        }
        if (step === 'audio') {
          // (2.4.0) the commentary of the test race: a set of your own, a new set made from the preset (once), or none
          const A = audioNow();
          A.voice = ($('wz-voice') || {}).value ?? A.voice;
          if (!A.none && !A.own) {
            const sets = await A_list('audiosets');
            const made = A.setId && sets.find(x => x.id === A.setId);
            const want = {
              ...Sound.profile(Sound.defaultSet(`Commentary · ${A.preset}`), A.preset),
              name: `Commentary · ${A.preset}`,
              voice: A.voice
            };
            if (made) await A_upd('audiosets', made.id, want);
            else A.setId = (await api.add('audiosets', want)).id;
          }
          return await go(7, { audio: A });
        }
        if (step === 'sensors') {
          const s = sensors ? SensorTest.summary(sensors.tally) : { ok: true };
          if (
            !s.ok &&
            !(await Dialog.confirm(s.text + '\n\nGo on anyway? You can test again on Home before a race.', {
              ok: 'Go on',
              cancel: 'Test again'
            }))
          )
            return;
          stopSensors();
          return await go(6);
        }
        if (step === 'finish') {
          const track = (o.tracks || []).find(t => t.id === p.trackId);
          if (track) {
            const au = p.audio && !p.audio.none ? p.audio.own || p.audio.setId : '';
            const setup = await A.add('racesetups', { ...setupRecord(S.schema, track.id), ...(au ? { audioSet: au } : {}) });
            const rows = assignmentRows(lanes, p.driverIds, p.carIds);
            await save({ lastSetupId: setup.id, assignments: { ...(S.settings.assignments || {}), [setup.id]: rows } });
          }
          await finish('done');
          return render();
        }
      } catch (e) {
        msg('Could not save: ' + (e && e.message ? e.message : e));
      } finally {
        if (b.isConnected) b.disabled = false;
      }
    };
  }

  // (2.4.0) "Back to the guide": while the guide sent you to another page, a pill at the bottom of the window brings you back to its step
  function pill() {
    if (typeof document === 'undefined') return;
    const S = typeof state !== 'undefined' ? state : null,
      g = S && S.settings && S.settings.setupGuide,
      show = !!(S && S.guideBack && S.tab !== 'home' && g && typeof g === 'object');
    let el = document.getElementById('wz-back');
    if (!show) {
      if (el) el.remove();
      if (S && S.tab === 'home') S.guideBack = null;
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.id = 'wz-back';
      el.setAttribute('role', 'region');
      el.setAttribute('aria-label', 'Setup guide');
      document.body.appendChild(el);
      el.onclick = ev => {
        if (!(ev.target && ev.target.closest && ev.target.closest('[data-wzback]'))) return;
        S.guideBack = null;
        S.tab = 'home';
        render();
      };
    }
    el.innerHTML = `<b>Setup guide</b><span>step ${S.guideBack.step} · ${esc(S.guideBack.title)}</span><button type="button" class="btn primary sm" data-wzback>← Back to the guide</button>`;
  }
  const guide = {
    STEPS,
    TEST_LAPS,
    PRESETS,
    VERSION,
    shouldShow,
    progressOf,
    setupRecord,
    assignmentRows,
    namesOf,
    render: draw,
    stop: stopSensors,
    pill
  };
  root.SetupWizard = guide;
  if (typeof module !== 'undefined') module.exports = guide;
})(typeof window !== 'undefined' ? window : globalThis);
