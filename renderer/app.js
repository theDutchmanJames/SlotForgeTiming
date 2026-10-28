const view = document.getElementById('view');
const tabsEl = document.getElementById('tabs');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const TABS = [['home', 'Home'], ['database', 'Database'], ['setup', 'Race Setup'], ['custom', 'Customization'], ['settings', 'App Settings'], ['rules', 'Racing Rules'], ['live', 'Live Race', 'onair']]; // 'onair': the tab looks like a Live on Air sign (a red light and red letters, always, it does not follow the race)
// The line picture to the left of each main tab (icons.js). The Live Race tab has none: it has its own look. The tabs inside a screen have none either.
const TAB_ICONS = { home: 'home', database: 'database', setup: 'setup', custom: 'custom', settings: 'settings', rules: 'rules' };
const state = { tab: 'home', sub: 'tracks', schema: {}, settings: { theme: 'dark' }, custom: {}, refs: {}, setupSub: 'setups', customSub: 'layouts', settingsSub: 'general', hwSub: 'trackmate', editing: null };

const titleOf = (entity, item) =>
  state.schema[entity].title.map(k => item[k]).filter(Boolean).join(' ') || '(unnamed)';

const DEFAULT_NAME = 'SlotForge Timing';
const DEFAULT_WELCOME = 'Welcome to the SlotForge Slotcar Timing App!';
// the welcome message at the top of the Home tab (changeable in App Settings); empty means the default
const welcomeOf = () => (state.settings.welcome || '').trim() || DEFAULT_WELCOME;
// the name shown in the app's header and window title (changeable in App Settings)
function applyName() {
  const n = (state.settings.appName || '').trim() || DEFAULT_NAME, h = document.querySelector('h1');
  if (h) h.textContent = n;
  document.title = n;
}

// The header picture on the Home tab: its size and position come from banner.js. `automatic` is the style to use when the height is automatic.
const bannerStyle = (s, automatic = '') => { const c = Banner.css(s, automatic); return c ? ` style="${c}"` : ''; };

// The header of the Home tab, or its preview in App Settings (`preview`): the header picture and, beside it, the club logo when that is shown.
// Without a logo it is just the picture, as it always was. With one, the header is two columns that share one height: the logo is always shown whole,
// and the picture fills the rest (cropped as needed). With an automatic height the picture's own shape decides the height, from a hidden copy that spans the full width.
function homeHeaderHtml(s, preview = false) {
  const pic = s.homeHeader, logo = Banner.logoOn(s);
  if (!pic && !logo) return '';
  if (!logo) return preview ? `<img class="homebanner" id="hdrprev" src="${esc(pic)}" alt="" draggable="false"${bannerStyle(s, 'max-height:110px')}>` : `<div class="homehead"><img class="homebanner" src="${esc(pic)}" alt=""${bannerStyle(s)}></div>`;
  const left = Banner.logoSide(s) === 'left', col = n => `grid-column:${n};`, pc = Banner.posCss(Banner.pos(s)), lc = Banner.posCss(Banner.logoPos(s));
  const bannerCell = pic ? `<div class="hcell" style="${col(left ? 2 : 1)}"><img class="homebanner"${preview ? ' id="hdrprev" draggable="false"' : ''} src="${esc(pic)}" alt=""${pc ? ` style="${pc}"` : ''}></div>` : '';
  const logoCell = `<div class="hcell hlogo" style="${col(left ? 1 : 2)}"><img${preview ? ' id="logoprev"' : ''} src="${esc(s.clubLogo)}" alt=""${lc ? ` style="${lc}"` : ''}></div>`;
  const sizer = pic && !Banner.height(s) ? `<img class="hsizer" src="${esc(pic)}" alt="" aria-hidden="true"${preview ? ' style="max-height:110px"' : ''}>` : '';
  return `<div class="homehead withlogo"${preview ? ' id="hdrbox"' : ''} style="${Banner.boxCss(s)}">${sizer}${left ? logoCell + bannerCell : bannerCell + logoCell}</div>`;
}

// `icons` (only the main tabs pass it) says which line picture goes to the left of the text of a tab: { tab id: picture name from icons.js }
function renderTabs(el, items, current, onPick, icons = {}) {
  el.innerHTML = items.map(([id, label, look]) =>
    look === 'racing' ? `<button class="tab racetab" role="tab" aria-selected="${id === current}" data-id="${id}" title="${esc(raceTabTitle())}"><span class="led on" aria-hidden="true"></span>${esc(label)}</button>`
    : look === 'onair' ? `<button class="tab onair" role="tab" aria-selected="${id === current}" data-id="${id}" title="Opens the Live Race on a second screen"><span class="led red" aria-hidden="true"></span>${esc(label)}</button>`
    : look === 'offair' ? `<button class="tab onair off" role="tab" aria-selected="${id === current}" data-id="${id}" title="No race is running. Opens the Live Race on a second screen anyway."><span class="led" aria-hidden="true"></span>${esc(label)}</button>`
      : Icons.has(icons[id]) ? `<button class="tab hasico" role="tab" aria-selected="${id === current}" data-id="${id}">${Icons.svg(icons[id], { size: 18, cls: 'tabico' })}${esc(label)}</button>`
        : `<button class="tab" role="tab" aria-selected="${id === current}" data-id="${id}">${esc(label)}</button>`).join('');
  el.onclick = e => { const b = e.target.closest('[data-id]'); if (b) onPick(b.dataset.id); };
}

// ---- the race that keeps running ----
// The race screen lives in its own place on the page (#racehost, see race.js), so another tab can be shown while the race goes on: it keeps timing, counting laps and sharing
// to the Live Race pages. While another tab is shown the race is "parked" (out of sight, but still laid out and drawn). A red Race tab takes you back to it.
// A race that has not started yet (or is over and was left with the Back button) is not kept: leaving it closes it, as it always did.
const raceKept = () => !!state.race && typeof live !== 'undefined' && !!live && !!live.alive;
const RACE_WORDS = { ready: 'not started yet', countdown: 'starting', running: 'running', paused: 'paused', between: 'waiting for the next heat', review: 'waiting for you to check the laps', finished: 'finished' };
const raceTabTitle = () => `The race is ${RACE_WORDS[typeof live !== 'undefined' && live ? live.phase : ''] || 'on'}. Click to go back to it.`;
// The Live Race tab has two looks (1.10.1): lit (red light) while a race is on, switched off (grey, the light out) when no race is running. It opens the Live Race pages in both cases.
const tabsNow = () => (raceKept() ? [...TABS.slice(0, -1), ['race', 'Race', 'racing'], TABS[TABS.length - 1]] : TABS.map(t => (t[2] === 'onair' ? [t[0], t[1], 'offair'] : t)));
function showRace(on) { // on: the Race tab is shown; otherwise the race (if there is one) is parked out of sight
  const h = document.getElementById('racehost');
  if (h) h.classList.toggle('parked', !on);
  view.hidden = !!(h && on);
}

// App Settings: General and Network
async function renderSettings() {
  if (typeof ppPageDispose === 'function') ppPageDispose();
  view.innerHTML = '<h2>App Settings</h2><div class="sub" id="settingstabs" role="tablist"></div><div id="settingsbox"></div>';
  renderTabs(document.getElementById('settingstabs'), [['general', 'General'], ['theme', 'App Theme'], ['director', 'Race Director'], ['calculations', 'Calculations'], ['network', 'Network'], ['hardware', 'Timing Hardware'], ['transfer', 'Import and Export'], ['help', 'Help']], state.settingsSub, id => { state.settingsSub = id; renderSettings(); });
  if (state.settingsSub === 'help') return Help.render(document.getElementById('settingsbox'));
  if (state.settingsSub === 'transfer') return renderTransferSettings(document.getElementById('settingsbox'));
  if (state.settingsSub === 'theme') return renderThemeSettings(document.getElementById('settingsbox'));
  if (state.settingsSub === 'director') return renderPadSettings(document.getElementById('settingsbox'));
  if (state.settingsSub === 'calculations') return renderCalculationSettings(document.getElementById('settingsbox'));
  if (state.settingsSub === 'hardware') return renderHardwareArea(document.getElementById('settingsbox'));
  if (state.settingsSub === 'network') return renderNetworkSettings(document.getElementById('settingsbox'));
  return renderGeneralSettings(document.getElementById('settingsbox'));
}

// App Settings > Calculations: plain-language formula library. The controls are
// deliberately named calculation methods instead of an arbitrary code editor: a
// formula must stay safe, repeatable, and understandable in saved race results.
function renderCalculationSettings(box) {
  return CalculationPage.render(box);
}

// Timing Hardware has a page per kind of hardware: the Trackmate Interface, the Arduino box, DS Electronics (a listening version for now), oXigen Digital (a place held for it, nothing to set up yet) and Other (empty for now).
// At the top the person chooses the timing hardware IN USE, one at a time (Hardware.timingChosen): only that one connects by itself at the start, counts laps in a race and is shown on Home and on the race screen.
// The other pages stay usable for setting up and testing; a page that is not the one in use says so and has a "Use this one" button.
async function setTimingHw(id) { // saves the choice and lets go of the hardware that was in use; connecting the new one and drawing the page is up to the caller
  const old = Hardware.timingChosen(state.settings);
  if (old !== id && raceKept()) { if (typeof alert === 'function') alert('Finish or leave the race before changing its timing hardware.'); return false; }
  state.settings = await api.setSettings({ timingHw: id });
  { const sel = document.getElementById('hw-use'), n = document.getElementById('hwnote'); // (the page may be on screen: it follows)
    if (sel) sel.value = id;
    if (n && state.hwSub === id) { n.hidden = true; n.innerHTML = ''; } }
  if (old !== id) {
    try { if (old === 'trackmate' && typeof hw !== 'undefined' && hw.open && typeof tmClose === 'function') await tmClose(); } catch (x) { /* already gone */ }
    try { if (old === 'arduino' && typeof ab !== 'undefined' && ab.open && typeof abClose === 'function') await abClose(); } catch (x) { /* already gone */ }
    if (old === 'parallel' && typeof ppClose === 'function') await ppClose();
    if (old === 'phidget' && typeof phClose === 'function') await phClose();
  }
}
function renderHardwareArea(box) {
  if (typeof ppPageDispose === 'function') ppPageDispose();
  const chosen = Hardware.timingChosen(state.settings), names = { trackmate: 'the Trackmate Interface', arduino: 'the Arduino box', parallel: 'the Parallel Port', phidget: 'the Phidget Interface', none: 'no timing hardware' };
  const onPage = ['trackmate', 'arduino', 'parallel', 'phidget'].includes(state.hwSub);
  box.innerHTML = `<div class="row" id="hwuse"><label><strong>Timing hardware in use</strong> <select id="hw-use">${Hardware.TIMING.map(([id, name]) => `<option value="${id}"${id === chosen ? ' selected' : ''}>${esc(name)}</option>`).join('')}</select></label>
      <span class="muted">One at a time. Only this one connects by itself, counts the laps of a race and shows on Home and on the race screen.</span></div>
    <div class="sub" id="hwtabs" role="tablist"></div>
    <p class="muted" id="hwnote"${onPage && state.hwSub !== chosen ? '' : ' hidden'}>${onPage && state.hwSub !== chosen ? `This page is not in use for races: the app uses ${esc(names[chosen])}. <button class="btn" id="hw-usethis">Use this one</button>` : ''}</p>
    <div id="hwbox"></div>`;
  renderTabs(document.getElementById('hwtabs'), [['trackmate', 'Trackmate Interface'], ['arduino', 'Arduino'], ['parallel', 'Parallel Port'], ['phidget', 'Phidget'], ['ds', 'DS Electronics'], ['oxigen', 'oXigen Digital'], ['other', 'Other']], state.hwSub, id => { state.hwSub = id; renderHardwareArea(box); });
  const use = async id => { // the choice changed: the hardware that was in use is let go, the new one connects by itself when it can
    if (await setTimingHw(id) === false) return;
    if (id === 'trackmate' && typeof tmAutoConnect === 'function') tmAutoConnect();
    if (id === 'arduino' && typeof abAutoConnect === 'function') abAutoConnect();
    if (id === 'parallel' && typeof ppAutoConnect === 'function') ppAutoConnect();
    if (id === 'phidget') phAutoConnect();
    if (id !== 'none') state.hwSub = id;
    renderHardwareArea(box);
  };
  document.getElementById('hw-use').onchange = e => use(e.target.value);
  document.getElementById('hw-use').disabled = raceKept();
  const again = document.getElementById('hw-usethis'); if (again) again.onclick = () => use(state.hwSub);
  if (again) again.disabled = raceKept();
  if (state.hwSub === 'other') return;
  if (state.hwSub === 'arduino') return renderArduinoSettings(document.getElementById('hwbox'));
  if (state.hwSub === 'phidget') return renderPhidgetSettings(document.getElementById('hwbox'));
  if (state.hwSub === 'parallel') return renderParallelSettings(document.getElementById('hwbox'));
  if (state.hwSub === 'ds') return renderDsSettings(document.getElementById('hwbox'));
  if (state.hwSub === 'oxigen') return renderOxigenSettings(document.getElementById('hwbox'));
  renderHardwareSettings(document.getElementById('hwbox'));
}

// App Settings > Timing Hardware > oXigen Digital: only a place held for it. Nothing connects, nothing is saved and a race does not use it yet; the page is filled in when the support for oXigen Digital comes.
function renderOxigenSettings(box) {
  box.innerHTML = `<p class="muted"><strong>Coming.</strong> This page is the place for <strong>oXigen Digital</strong> timing. There is nothing to set up here yet: the app does not connect to anything on this page, and a race does not use it.</p>`;
}

const GENERAL_FOLDERS = ['display', 'names', 'header', 'logo', 'pictures', 'performance', 'data'];
// the size of the interface: the window is zoomed (the Live Race window and the pages on phones are not; see UiScale)
const applyUiScale = () => { if (typeof api !== 'undefined' && api.setZoom) api.setZoom(UiScale.factorOf(state.settings && state.settings.uiScale)); };
async function renderGeneralSettings(box) {
  const S = state.settings, path = await api.dbPath(), hh = Banner.height(S), pos = Banner.pos(S), lpos = Banner.logoPos(S);
  const us = UiScale.levelOf(S.uiScale), dp = Depth.levelOf(S.depth), su = Speed.unitOf(S), du = Speed.distUnitOf(S), pq = Picture.levelOf(S.pictureQuality), pic = !!S.homeHeader, logoOn = Banner.logoOn(S), hasLogo = !!S.clubLogo, side = Banner.logoSide(S), share = Banner.logoShare(S);
  // the page is made of folders, as the Results and Records page is: each opens and closes, the choice is remembered while the app runs
  const sf = (id, title, note, body) => folderHtml('general', id, title, note, `<div class="fbody">${body}</div>`);
  box.innerHTML = folderTools
    + sf('display', 'Display', 'interface size ' + us + '%, speeds in ' + Speed.unitName(su) + ', distances in ' + Speed.distUnitName(du), `<div class="field" style="max-width:480px"><label for="uiscale">Interface size (the text, buttons and check boxes of the whole app)</label>
      <select id="uiscale">${UiScale.LEVELS.map(([k, t]) => `<option value="${k}"${k === us ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
      <span class="muted hint">Makes everything in this window bigger, for reading from a distance or with glasses. It does not change the layouts of the race screens: they always fit the window, and the size of their widgets is set in the Layout Editor. It is only for this window: the Live Race window and the pages on phones keep their size.</span></div>
    <div class="field" style="max-width:480px"><label for="depthlevel">Depth (how much cards, buttons, folders and widgets stand up from the page)</label>
      <select id="depthlevel">${Depth.LEVELS.map(([k, t]) => `<option value="${k}"${k === dp ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
      <span class="muted hint">A light edge on top, a thin lip underneath and a soft shadow, so a card looks a little thick and a button a little shallow. A pressed button moves down. Flat is the plain look of before, and it is a little lighter to draw, which can help on a slow computer such as a Raspberry Pi. It applies to the whole app, the Live Race pages and the widgets of your layouts, on this computer and on the devices that follow the race.</span></div>
    <div class="field" style="max-width:480px"><label for="speedunit">Speed unit in the tables (Results and Records, the PDF of a session)</label>
      <select id="speedunit">${Speed.UNITS.map(([k, t]) => `<option value="${k}"${k === su ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
      <span class="muted hint">The average speed and the scale speed of the laps, sessions, stints and records. The Speed widget in a layout has a Unit choice of its own.</span></div>
    <div class="field" style="max-width:480px"><label for="distunit">Distance unit (the distance driven in the tables and on Home, and the lengths of a track)</label>
      <select id="distunit">${Speed.DIST_UNITS.map(([k, t]) => `<option value="${k}"${k === du ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
      <span class="muted hint">Feet and miles show the distance in the tables and on the At a glance card in feet (up to a mile) and miles, and you type the length of a track, its lanes and its pieces in feet and inches. Everything stays saved in metres, so you can change this at any time and nothing is lost.</span></div>`)
    + sf('names', 'Name and welcome', S.appName ? S.appName : 'the standard name', `<div class="field" style="max-width:360px"><label for="appname">App Name (shown at the top of the window)</label><input id="appname" type="text" maxlength="40" value="${esc(S.appName || '')}" placeholder="${DEFAULT_NAME}"></div>
    <div class="field" style="max-width:560px"><label for="welcome">Welcome Message (shown at the top of the Home tab)</label><input id="welcome" type="text" maxlength="120" value="${esc(S.welcome || '')}" placeholder="${esc(DEFAULT_WELCOME)}"><span class="muted hint">Leave it empty for the standard message.</span></div>`)
    + sf('header', 'Header picture', pic ? 'a picture is set' : 'no picture', `<div class="field" style="max-width:480px"><label for="hdrfile">Header picture on the Home tab</label>
      ${homeHeaderHtml(S, true)}
      <div class="row"><input id="hdrfile" type="file" accept="image/*">${pic ? '<button class="btn" id="hdrclear">Remove picture</button>' : ''}</div>
      ${pic || logoOn ? `<div class="row"><label for="hdrh" style="min-width:5.5em">Height</label><input id="hdrh" type="range" min="5" max="60" step="1" value="${hh || Banner.DEFAULT_HEIGHT}"${hh || !pic ? '' : ' disabled'} aria-describedby="hdrhv" style="flex:1"><output id="hdrhv" for="hdrh" style="min-width:5em">${hh || !pic ? (hh || Banner.DEFAULT_HEIGHT) + '% of the width' : 'automatic'}</output>
        ${pic ? `<label class="inline"><input id="hdrauto" type="checkbox"${hh ? '' : ' checked'}> Automatic</label>` : ''}</div>
      <span class="muted hint">${pic ? 'Automatic follows the shape of the picture. A set height is a share of the window width, so the header looks the same on every screen; a picture that is taller than that is cropped.' + (logoOn ? ' The club logo beside the picture has the same height.' : '') : 'The height is a share of the window width, so the header looks the same on every screen.'}</span>` : ''}
      ${pic ? `<div class="row"><label for="hdrx" style="min-width:5.5em">Left / right</label><input id="hdrx" type="range" min="0" max="100" step="1" value="${Math.round(pos.x)}" aria-describedby="hdrxv" style="flex:1"><output id="hdrxv" for="hdrx" style="min-width:5em">${Math.round(pos.x)}%</output></div>
      <div class="row"><label for="hdry" style="min-width:5.5em">Up / down</label><input id="hdry" type="range" min="0" max="100" step="1" value="${Math.round(pos.y)}" aria-describedby="hdryv" style="flex:1"><output id="hdryv" for="hdry" style="min-width:5em">${Math.round(pos.y)}%</output></div>
      <div class="row"><button class="btn" id="hdrcenter">Center the picture</button></div>
      <span class="muted hint">Drag the picture, or use the sliders, to choose which part of it shows. It can only move in the direction in which it is cropped; a slider is greyed out when nothing is cropped that way.</span>` : ''}</div>`)
    + sf('logo', 'Club logo', !hasLogo ? 'no logo yet' : logoOn ? 'shown on the Home tab' : 'not on the Home tab', `<div class="field" style="max-width:480px"><label for="logofile">Club logo</label>
      ${hasLogo && !logoOn ? `<img class="optimg" id="logothumb" src="${esc(S.clubLogo)}" alt="Your club logo">` : ''}
      <div class="row"><input id="logofile" type="file" accept="image/*">${hasLogo ? '<button class="btn" id="logoclear">Remove logo</button>' : ''}</div>
      <span class="muted hint">Shown on the Home tab if you choose a side below, and by every Logo widget in a layout that has no logo picture of its own.</span>
      ${hasLogo ? `<div class="row"><label for="logoside" style="min-width:5.5em">On the Home tab</label><select id="logoside"><option value=""${side ? '' : ' selected'}>Not shown</option><option value="left"${side === 'left' ? ' selected' : ''}>Left of the header picture</option><option value="right"${side === 'right' ? ' selected' : ''}>Right of the header picture</option></select></div>` : ''}
      ${logoOn ? `<div class="row"><label for="logow" style="min-width:5.5em">Width</label><input id="logow" type="range" min="10" max="50" step="1" value="${share}" aria-describedby="logowv" style="flex:1"><output id="logowv" for="logow" style="min-width:5em">${share}% of the header</output></div>
      <div class="row"><label for="logox" style="min-width:5.5em">Left / right</label><input id="logox" type="range" min="0" max="100" step="1" value="${Math.round(lpos.x)}" aria-describedby="logoxv" style="flex:1"><output id="logoxv" for="logox" style="min-width:5em">${Math.round(lpos.x)}%</output></div>
      <div class="row"><label for="logoy" style="min-width:5.5em">Up / down</label><input id="logoy" type="range" min="0" max="100" step="1" value="${Math.round(lpos.y)}" aria-describedby="logoyv" style="flex:1"><output id="logoyv" for="logoy" style="min-width:5em">${Math.round(lpos.y)}%</output></div>
      <div class="row"><button class="btn" id="logocenter">Center the logo</button></div>
      <span class="muted hint">The logo is always shown whole, as large as its space allows, and takes its height from the header. Its width is a share of the header; the picture gets the rest. The sliders move the logo inside its space: a slider is greyed out when the logo already fills it that way.</span>` : ''}</div>`)
    + sf('pictures', 'Pictures', (Picture.LEVELS.find(l => l[0] === pq) || [0, ''])[1], `<div class="field" style="max-width:480px"><label for="picq">Quality of the pictures you upload (drivers, slotcars, widgets, picture sets, logo, header)</label>
      <select id="picq">${Picture.LEVELS.map(([k, t]) => `<option value="${k}"${k === pq ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
      <span class="muted hint">Original keeps a picture exactly as you uploaded it, with its transparency (only a picture over 4000 px or 12 MB is made smaller). Pictures are saved inside the database file, so many large originals make the database bigger and the app slower to open, especially on a small computer such as a Raspberry Pi: choose High or Standard then. This applies to pictures you upload from now on; pictures that are already saved stay as they are.</span></div>`)
    + sf('performance', 'Performance', 'how the computer and the app are doing', `<div class="field" style="max-width:640px"><label class="inline"><input id="layerswitch" type="checkbox"${Depth.layersOn(S) ? ' checked' : ''}> Draw the changing text of each widget on its own layer</label>
      <span class="muted hint">Makes the race screen much lighter for the graphics card, most of all on a slow computer such as a Raspberry Pi: when a number changes, only that number is drawn again, not the whole page with every shadow. The look stays the same, but text can be a little softer on some Windows computers: switch this off if you see that. It applies to the race screen and the Live Race pages.</span></div>
      <div class="field" style="max-width:640px"><label class="inline"><input id="bgsave" type="checkbox"${S.backgroundSave === false ? '' : ' checked'}> Save changes to the database in the background</label>
      <span class="muted hint">When you save a driver, a slotcar, a race setup or a finished race, the whole database file is written again. With big pictures that takes a third of a second or more, and the program used to stand still for that time. In the background the program goes on while the file is written, and the change is on the disk when the screen says it is saved. Switch this off to go back to the old way (the program waits for the disk).</span></div>
      <div class="field" style="max-width:640px"><label class="inline"><input id="perfswitch" type="checkbox"${S.perfLine ? ' checked' : ''}> Show the Performance line on the race screen</label>
      <span class="muted hint">A small line under the buttons of the race screen: how many frames a second the window draws, how long a screen update takes, the CPU the app uses (window, graphics and the core of the app) and how long the core was stuck. Nothing is measured while it is off.</span></div>
      <div class="field"><label for="perfout">Report (updated every second while this folder is open)</label>
      <pre id="perfout" class="perfout" tabindex="0">measuring...</pre>
      <div class="row"><button class="btn" id="perfcopy" type="button">Copy report</button><span id="perfmsg" class="muted" role="status"></span></div>
      <span class="muted hint">Open the race screen with a race running while you look at this, or leave the line on and look at it during a race. If the Raspberry Pi gets slow, copy the report and send it: it shows whether the window is drawn by the graphics card or by the processor, how hot the processor is, and what the app is busy with. Measuring costs a little itself.</span></div>`)
    + sf('data', 'Database file', 'where everything is saved', `<div class="row"><span>Saved in:</span><code>${esc(path)}</code></div>`);
  if (typeof AppSettingsPage !== 'undefined') AppSettingsPage.enhance(box, 'general');
  folderWire(box);
  box.onclick = ev => { const fa = ev.target && ev.target.closest ? ev.target.closest('[data-folderall]') : null; if (fa) { folderAll('general', GENERAL_FOLDERS, fa.dataset.folderall === '1'); renderGeneralSettings(box); } };
  const $ = id => document.getElementById(id);
  $('uiscale').onchange = async ev => { state.settings = await api.setSettings({ uiScale: UiScale.levelOf(ev.target.value) }); applyUiScale(); renderSettings(); };
  $('depthlevel').onchange = async ev => { state.settings = await api.setSettings({ depth: Depth.levelOf(ev.target.value) }); applyDepth(); renderSettings(); };
  $('speedunit').onchange = async ev => { state.settings = await api.setSettings({ speedUnit: Speed.unitOf({ speedUnit: ev.target.value }) }); renderSettings(); };
  $('distunit').onchange = async ev => { state.settings = await api.setSettings({ distanceUnit: Speed.distUnitOf({ distanceUnit: ev.target.value }) }); renderSettings(); };
  $('bgsave').onchange = async ev => { state.settings = await api.setSettings({ backgroundSave: !!ev.target.checked }); }; // (1.61.2: the core reads it from the settings at once)
  $('layerswitch').onchange = async ev => { state.settings = await api.setSettings({ widgetLayers: !!ev.target.checked }); applyLayers(); }; // (the page is not drawn again: the style sheet does the rest)
  $('perfswitch').onchange = async ev => { state.settings = await api.setSettings({ perfLine: !!ev.target.checked }); }; // (the page is not drawn again: the report goes on)
  if (typeof PerfUI !== 'undefined') PerfUI.panel({ out: $('perfout'), copy: $('perfcopy'), msg: $('perfmsg') });
  $('picq').onchange = async ev => { state.settings = await api.setSettings({ pictureQuality: Picture.levelOf(ev.target.value) }); renderSettings(); };
  $('appname').onchange = async ev => { state.settings = await api.setSettings({ appName: ev.target.value.trim() }); applyName(); };
  $('welcome').onchange = async ev => { state.settings = await api.setSettings({ welcome: ev.target.value.trim() }); };
  $('hdrfile').onchange = async ev => {
    const f = ev.target.files && ev.target.files[0]; if (!f) return;
    try { state.settings = await api.setSettings({ homeHeader: await resizeImage(f, 1600), homeHeaderPos: { x: 50, y: 50 } }); } catch (x) { alert(x.message); }
    renderSettings();
  };
  if (pic) $('hdrclear').onclick = async () => { state.settings = await api.setSettings({ homeHeader: '' }); renderSettings(); };
  $('logofile').onchange = async ev => { // shrunk, and transparency is kept
    const f = ev.target.files && ev.target.files[0]; if (!f) return;
    try { state.settings = await api.setSettings({ clubLogo: await resizeImage(f, 600, true), homeLogoPos: { x: 50, y: 50 } }); } catch (x) { alert(x.message); }
    renderSettings();
  };
  if (hasLogo) $('logoclear').onclick = async () => { state.settings = await api.setSettings({ clubLogo: '' }); renderSettings(); };
  if (hasLogo) $('logoside').onchange = async ev => { state.settings = await api.setSettings({ homeLogoSide: ev.target.value }); renderSettings(); };
  if (!pic && !logoOn) return;
  // The Home header and the logo: what is changed is shown while a control moves or the picture is dragged, and saved when it is let go
  const at = (on, id) => (on ? $(id) : null); // the controls that were drawn
  const prev = at(pic, 'hdrprev'), hbox = at(logoOn, 'hdrbox'), lprev = at(logoOn, 'logoprev'), slider = at(true, 'hdrh'), auto = at(pic, 'hdrauto'), px = at(pic, 'hdrx'), py = at(pic, 'hdry'), lw = at(logoOn, 'logow'), lx = at(logoOn, 'logox'), ly = at(logoOn, 'logoy');
  let cur = pos, lcur = lpos, grab = null, movable = false; // the positions being shown; while the picture is dragged: where the pointer and the picture were at the start; whether the picture can be moved at all
  const sizes = () => ({ box: { w: prev.clientWidth, h: prev.clientHeight }, natural: { w: prev.naturalWidth, h: prev.naturalHeight } });
  const draft = () => ({ ...state.settings, homeHeaderHeight: slider ? (auto && auto.checked ? '' : slider.value) : state.settings.homeHeaderHeight, homeHeaderPos: cur, homeLogoShare: lw ? lw.value : state.settings.homeLogoShare, homeLogoPos: lcur });
  const show = () => { // the pictures, the sliders and the cursor follow the height, the width of the logo and the positions
    const d = draft();
    if (hbox) hbox.style.cssText = Banner.boxCss(d);
    if (prev) prev.style.cssText = hbox ? Banner.posCss(cur) : Banner.css(d, 'max-height:110px');
    if (lprev) lprev.style.cssText = Banner.posCss(lcur);
    if (px) {
      const z = sizes(), room = Banner.overflow(z.box, z.natural); // how far the picture sticks out of its box: only that can move
      px.value = cur.x; py.value = cur.y; $('hdrxv').textContent = Math.round(cur.x) + '%'; $('hdryv').textContent = Math.round(cur.y) + '%';
      px.disabled = room.x < 1; py.disabled = room.y < 1;
      movable = room.x >= 1 || room.y >= 1; prev.classList.toggle('movable', movable);
    }
    if (lx) {
      const room = Banner.logoRoom({ w: lprev.clientWidth, h: lprev.clientHeight }, { w: lprev.naturalWidth, h: lprev.naturalHeight }); // how much space the whole logo leaves in its box: only that can move
      lx.value = lcur.x; ly.value = lcur.y; $('logoxv').textContent = Math.round(lcur.x) + '%'; $('logoyv').textContent = Math.round(lcur.y) + '%';
      lx.disabled = room.x < 1; ly.disabled = room.y < 1;
    }
  };
  const savePos = async () => { state.settings = await api.setSettings({ homeHeaderPos: { ...cur } }); };
  const saveLogoPos = async () => { state.settings = await api.setSettings({ homeLogoPos: { ...lcur } }); };
  if (prev) prev.onload = show;
  if (lprev) lprev.onload = show;
  show(); // (if a picture is not ready yet, show runs again when it is)
  folderWire(box, show); // (a folder that is closed has no size: the preview is measured again when one is opened)
  if (slider) {
    slider.oninput = () => { $('hdrhv').textContent = slider.value + '% of the width'; show(); };
    slider.onchange = async () => { state.settings = await api.setSettings({ homeHeaderHeight: Number(slider.value) }); };
  }
  if (auto) auto.onchange = async () => { state.settings = await api.setSettings({ homeHeaderHeight: auto.checked ? '' : Number(slider.value) }); renderSettings(); };
  if (px) {
    px.oninput = () => { cur = { ...cur, x: Number(px.value) }; show(); }; px.onchange = savePos;
    py.oninput = () => { cur = { ...cur, y: Number(py.value) }; show(); }; py.onchange = savePos;
    $('hdrcenter').onclick = () => { cur = { x: 50, y: 50 }; show(); savePos(); };
    prev.onpointerdown = ev => {
      if (ev.button || !movable) return;
      grab = { x: ev.clientX, y: ev.clientY, from: cur, ...sizes() };
      prev.setPointerCapture(ev.pointerId); prev.classList.add('dragging');
    };
    prev.onpointermove = ev => { if (grab) { cur = Banner.drag(grab.box, grab.natural, grab.from, ev.clientX - grab.x, ev.clientY - grab.y); show(); } };
    prev.onpointerup = prev.onpointercancel = () => { if (grab) { grab = null; prev.classList.remove('dragging'); savePos(); } };
  }
  if (lw) {
    lw.oninput = () => { $('logowv').textContent = lw.value + '% of the header'; show(); };
    lw.onchange = async () => { state.settings = await api.setSettings({ homeLogoShare: Number(lw.value) }); };
    lx.oninput = () => { lcur = { ...lcur, x: Number(lx.value) }; show(); }; lx.onchange = saveLogoPos;
    ly.oninput = () => { lcur = { ...lcur, y: Number(ly.value) }; show(); }; ly.onchange = saveLogoPos;
    $('logocenter').onclick = () => { lcur = { x: 50, y: 50 }; show(); saveLogoPos(); };
  }
}

async function renderNetworkSettings(box) {
  box.innerHTML = `<section data-settings-group="sharing"><h3>Share the race</h3><p class="muted">Let tablets and phones on your wifi follow the race in a browser: race timing, leaderboard, driver stats and the other Live Race pages. They can only watch. The Race Director page needs the password below.</p>
    <div class="field"><label class="inline"><input id="net-on" type="checkbox" ${state.settings.netOn ? 'checked' : ''}> Share on my network</label></div>
    <div class="settings-network-fields"><div class="field"><label for="net-port">Port</label><input id="net-port" type="number" min="1" max="65535" value="${esc(state.settings.netPort || 8787)}" style="width:7em"></div></div></section>
    <section data-settings-group="access"><h3>Director access</h3><div class="settings-network-fields"><div class="field"><label for="net-pass">Password for the Race Director</label><input id="net-pass" type="text" maxlength="40" value="${esc(state.settings.netPassword || '')}" placeholder="none: the Race Director stays on this computer"></div></div><p class="muted">Leave this empty to keep Race Director controls on this computer. Other devices can still watch when sharing is enabled.</p></section>
    <section data-settings-group="devices"><h3>Connect devices</h3><p class="muted">While sharing is enabled, this folder shows this computer’s addresses and QR codes.</p><div id="net-info"></div></section>`;
  if (typeof AppSettingsPage !== 'undefined') AppSettingsPage.enhance(box, 'network');
  const netInfo = async () => {
    const el = document.getElementById('net-info'); if (!el) return;
    const st = api.netStatus ? await api.netStatus() : null;
    if (!st) { el.innerHTML = ''; return; }
    el.innerHTML = st.error ? `<p class="error" role="alert">${esc(st.error)}</p>` : !st.on ? '' : `<p>Open one of these addresses on the other device, or scan its QR code:</p>
      <div class="netlist">${st.urls.length ? st.urls.map((u, i) => `<div class="netaddr"><div class="netqr">${u.svg}</div><code>${esc(u.url)}</code><button class="btn" data-qrpdf="${i}">Save QR code as PDF</button></div>`).join('') : '<p class="muted">No wifi or network connection was found on this computer.</p>'}</div>
      ${st.passwordSet ? '' : '<p class="muted">No password is set, so the Race Director page is closed to other devices.</p>'}
      <p id="net-msg" class="muted" role="status"></p>
      <p class="muted">The first time, Windows may ask whether the app can use the network: allow it on private networks.</p>`;
  };
  document.getElementById('net-info').onclick = async ev => { // print-ready QR code
    const b = ev.target.closest('[data-qrpdf]'); if (!b) return;
    const st = api.netStatus ? await api.netStatus() : null, u = st && st.urls && st.urls[Number(b.dataset.qrpdf)], msg = document.getElementById('net-msg'); if (!u) return;
    msg.textContent = 'Making the PDF...';
    try {
      const name = (state.settings.appName || '').trim() || DEFAULT_NAME;
      const res = await api.exportPdf(Report.qrHtml({ title: name + ' – Live Race', url: u.url, svg: u.svg }), 'QR code live race.pdf');
      msg.textContent = res && res.saved ? 'Saved: ' + res.path : 'Not saved.';
    } catch (x) { msg.textContent = 'Could not make the PDF: ' + x.message; }
  };
  const setNet = async patch => { state.settings = await api.setSettings(patch); await netInfo(); };
  document.getElementById('net-on').onchange = ev => setNet({ netOn: ev.target.checked });
  document.getElementById('net-port').onchange = ev => { const n = Math.round(Number(ev.target.value)); setNet({ netPort: n >= 1 && n <= 65535 ? n : 8787 }); if (!(n >= 1 && n <= 65535)) ev.target.value = 8787; };
  document.getElementById('net-pass').onchange = ev => setNet({ netPassword: ev.target.value });
  netInfo();
}

// Racing Rules: one text for the whole app (a club's code of conduct, for example) with a little formatting, saved as you type.
const RULE_SIZES = [['2', 'Small'], ['3', 'Normal'], ['5', 'Large'], ['6', 'Extra large']];
async function renderRules() {
  view.innerHTML = `<h2>Racing Rules</h2><p class="muted">General rules for racing, for example a club's code of conduct. Select text to make it bold, italic, underlined, bigger or coloured. They are saved as you type.</p>
    <div class="rte-bar" id="rte-bar" role="toolbar" aria-label="Text formatting">
      <button class="btn" type="button" data-cmd="bold" title="Bold" aria-label="Bold"><b>B</b></button><button class="btn" type="button" data-cmd="italic" title="Italic" aria-label="Italic"><i>I</i></button>
      <button class="btn" type="button" data-cmd="underline" title="Underline" aria-label="Underline"><u>U</u></button>
      <select id="rte-size" aria-label="Text size"><option value="">Size</option>${RULE_SIZES.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>
      <label class="inline">Colour <input type="color" id="rte-color" value="#d62828" aria-label="Text colour"></label>
      <button class="btn" type="button" data-cmd="heading" title="Heading">Heading</button><button class="btn" type="button" data-cmd="insertUnorderedList" title="Bulleted list">&bull; List</button>
      <button class="btn" type="button" data-cmd="insertOrderedList" title="Numbered list">1. List</button><button class="btn" type="button" data-cmd="removeFormat" title="Clear formatting">Clear formatting</button></div>
    <div id="rules" class="rules rte" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Racing rules" data-placeholder="Write your racing rules here...">${RichText.clean(state.settings.rules || '')}</div>
    <p class="rules-credit">${Report.CREDIT.map(esc).join('<br>')}</p>
    <div class="row">${pdfButton('id="rules-pdf"')}<span id="rulesmsg" class="muted" role="status"></span></div>`;
  const box = document.getElementById('rules'), msg = document.getElementById('rulesmsg'), bar = document.getElementById('rte-bar');
  let timer = null, range = null;
  const save = async () => { clearTimeout(timer); timer = null; state.settings = await api.setSettings({ rules: RichText.clean(box.innerHTML) }); msg.textContent = 'Saved.'; };
  const changed = () => { state.settings.rules = RichText.clean(box.innerHTML); msg.textContent = 'Saving...'; clearTimeout(timer); timer = setTimeout(save, 600); };
  // the colour picker and the size list take the focus: remember where the selection was and put it back before formatting
  const keep = () => { const sel = window.getSelection && window.getSelection(); if (sel && sel.rangeCount && box.contains(sel.anchorNode)) range = sel.getRangeAt(0).cloneRange(); };
  const restore = () => { box.focus(); const sel = window.getSelection && window.getSelection(); if (sel && range) { sel.removeAllRanges(); sel.addRange(range); } };
  const exec = (cmd, val) => { restore(); try { document.execCommand('styleWithCSS', false, false); } catch { /* not supported */ } document.execCommand(cmd, false, val); keep(); changed(); };
  box.onkeyup = keep; box.onmouseup = keep; box.onblur = () => { keep(); if (timer) save(); }; // leaving the box (or the tab) saves straight away
  box.oninput = changed;
  box.onpaste = ev => { ev.preventDefault(); const t = (ev.clipboardData && ev.clipboardData.getData('text/plain')) || ''; document.execCommand('insertText', false, t); }; // pasted text arrives without foreign formatting
  bar.onmousedown = ev => { if (ev.target.closest && ev.target.closest('button')) ev.preventDefault(); }; // pressing a button keeps the selection
  bar.onclick = ev => {
    const b = ev.target.closest && ev.target.closest('[data-cmd]'); if (!b) return;
    if (b.dataset.cmd === 'heading') { restore(); const inH = (window.getSelection().anchorNode || {}).parentElement && window.getSelection().anchorNode.parentElement.closest && window.getSelection().anchorNode.parentElement.closest('h2'); exec('formatBlock', inH ? 'div' : 'h2'); return; }
    exec(b.dataset.cmd);
  };
  document.getElementById('rte-size').onchange = ev => { if (ev.target.value) exec('fontSize', ev.target.value); ev.target.value = ''; };
  document.getElementById('rte-color').onchange = ev => exec('foreColor', ev.target.value);
  // a neat A4 page of the rules to print and hand out (what is typed so far, saved or not)
  document.getElementById('rules-pdf').onclick = async () => {
    if (!RichText.text(box.innerHTML)) { msg.textContent = 'Write some rules first.'; return; }
    msg.textContent = 'Making the PDF...';
    try {
      const name = (state.settings.appName || '').trim() || DEFAULT_NAME;
      const res = await api.exportPdf(Report.rulesHtml({ title: name + ' – Racing Rules', html: box.innerHTML }), 'Racing Rules.pdf');
      msg.textContent = res.saved ? 'Saved to ' + res.path : 'Export cancelled.';
    } catch (x) { msg.textContent = 'Could not make the PDF: ' + x.message; }
  };
}

async function render() {
  if (typeof ppPageDispose === 'function') ppPageDispose();
  view.onclick = null; view.onchange = null; // each screen sets up its own handlers
  LiveView.unmount();
  if (state.tab !== 'race' && typeof live !== 'undefined' && live && live.alive && !raceActive()) { // a race that is not on (not started, or over): the race screen is gone, no more keys, Trackmate or Race Director buttons
    if (live.leave) live.leave();
    live.alive = false; const h = document.getElementById('racehost'); if (h) h.innerHTML = '';
  }
  showRace(state.tab === 'race');
  const pick = id => {
    if (id === 'live') { if (typeof PerfUI !== 'undefined') PerfUI.mark('Live Race tab pressed'); api.liveOpen(); return; } // Live Race is the second screen: it opens its own window, also during a race
    if (typeof editorDirty === 'function' && editorDirty() && !confirm('Discard your unsaved layout changes?')) return;
    if (typeof editorLeave === 'function') editorLeave();
    if (typeof PerfUI !== 'undefined') PerfUI.mark(`Tab: ${id}`); // (for the Performance report, 1.60.1: what was on the screen when the figures changed)
    state.tab = id; render();
  };
  renderTabs(tabsEl, tabsNow(), state.tab, pick, TAB_ICONS);
  try {
    if (state.tab === 'home') { if (typeof resetHome === 'function') resetHome(); await renderHome(); } // (the laps for the cards on Home are fetched again every time Home is shown)
    else if (state.tab === 'race') await renderRace();
    else if (state.tab === 'database') await renderDatabase();
    else if (state.tab === 'settings') await renderSettings();
    else if (state.tab === 'rules') await renderRules();
    else if (state.tab === 'setup') await renderSetup();
    else if (state.tab === 'custom') await renderCustom();
    if (state.tab === 'race') renderTabs(tabsEl, tabsNow(), state.tab, pick, TAB_ICONS); // (the race exists now: its tab is shown, and it is the one that is open)
  } catch (e) { screenFailed(e); }
}

// A screen that cannot be drawn must never leave a dead page behind (the old page with its buttons switched off, as happened when a race could not be opened):
// it says what went wrong and offers the way back to Home.
function screenFailed(e) {
  console.error(e);
  if (state.tab === 'race') state.race = null; // (the race that could not be opened is not kept)
  showRace(false); // (this page is shown in the place of the other screens)
  view.onchange = null;
  view.innerHTML = `<section class="card" id="screenerror" role="alert"><h3>This screen could not be opened</h3><p>${esc(e && e.message ? e.message : e)}</p>
    <p class="muted">Nothing was lost: what was saved is still in the database. Go back to Home to carry on.</p><div class="row"><button class="btn primary" id="errhome">Back to Home</button></div></section>`;
  view.onclick = ev => { const b = ev.target && ev.target.closest ? ev.target.closest('#errhome') : null; if (b) { state.tab = 'home'; render(); } };
}

// A window that cannot start (the Live Race window on a second screen most of all) shows why, in place of an empty page; "Try again" loads it once more.
function bootFailed(e) {
  console.error(e);
  try {
    view.hidden = false; view.onchange = null;
    view.innerHTML = `<section class="card" id="bootfailed" role="alert"><h3>This window could not be opened</h3><p>${esc(e && e.message ? e.message : e)}</p>
      <p class="muted">Nothing was lost: what was saved is still in the database.</p><div class="row"><button class="btn primary" id="bootagain">Try again</button></div></section>`;
    view.onclick = ev => { const b = ev.target && ev.target.closest ? ev.target.closest('#bootagain') : null; if (b) location.reload(); };
  } catch (x) { /* the console has it */ }
}

(async () => {
  state.schema = await api.schema();
  state.settings = await api.getSettings();
  applyTheme(); applyDepth(); applyLayers(); applyName();
  if (typeof PicMemo !== 'undefined' && PicMemo.setLinks) PicMemo.setLinks(true); // big pictures in the widgets go to the page as short links (1.60.6): this window and the second screen
  if (typeof location !== 'undefined' && location.hash === '#live') { // the second-screen window: only the Live Race pages
    document.body.classList.add('lv-window'); document.querySelector('header').hidden = true;
    document.title = (state.settings.appName || DEFAULT_NAME) + ' – Live Race'; if (api.setZoom) api.setZoom(1); return LiveView.mount(view, { second: true }); // (the second screen keeps its own size)
  }
  if (typeof ppInit === 'function') ppInit();
  if (typeof phInit === 'function') phInit();
  applyUiScale();
  render();
  if (api.onHwChoose && typeof tmAutoConnect === 'function') tmAutoConnect(); // the remembered Trackmate, if it is plugged in
  if (typeof abAutoConnect === 'function') abAutoConnect(); // the remembered SlotForge box, or the virtual one when that is chosen
  if (typeof ppAutoConnect === 'function') ppAutoConnect();
  if (typeof phAutoConnect === 'function') phAutoConnect();
})().catch(bootFailed);
