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
    look === 'onair' ? `<button class="tab onair" role="tab" aria-selected="${id === current}" data-id="${id}" title="Opens the Live Race on a second screen"><span class="led red" aria-hidden="true"></span>${esc(label)}</button>`
      : Icons.has(icons[id]) ? `<button class="tab hasico" role="tab" aria-selected="${id === current}" data-id="${id}">${Icons.svg(icons[id], { size: 18, cls: 'tabico' })}${esc(label)}</button>`
        : `<button class="tab" role="tab" aria-selected="${id === current}" data-id="${id}">${esc(label)}</button>`).join('');
  el.onclick = e => { const b = e.target.closest('[data-id]'); if (b) onPick(b.dataset.id); };
}

// App Settings: General and Network
async function renderSettings() {
  view.innerHTML = '<h2>App Settings</h2><div class="sub" id="settingstabs" role="tablist" style="display:flex;gap:4px"></div><div id="settingsbox"></div>';
  renderTabs(document.getElementById('settingstabs'), [['general', 'General'], ['theme', 'App Theme'], ['network', 'Network'], ['hardware', 'Timing Hardware'], ['transfer', 'Import and Export'], ['help', 'Help']], state.settingsSub, id => { state.settingsSub = id; renderSettings(); });
  if (state.settingsSub === 'help') return Help.render(document.getElementById('settingsbox'));
  if (state.settingsSub === 'transfer') return renderTransferSettings(document.getElementById('settingsbox'));
  if (state.settingsSub === 'theme') return renderThemeSettings(document.getElementById('settingsbox'));
  if (state.settingsSub === 'hardware') return renderHardwareArea(document.getElementById('settingsbox'));
  if (state.settingsSub === 'network') return renderNetworkSettings(document.getElementById('settingsbox'));
  return renderGeneralSettings(document.getElementById('settingsbox'));
}

// Timing Hardware has a page per kind of hardware: the Trackmate Interface, DS Electronics (a listening version for now), and Other (empty for now)
function renderHardwareArea(box) {
  box.innerHTML = '<div class="sub" id="hwtabs" role="tablist" style="display:flex;gap:4px"></div><div id="hwbox"></div>';
  renderTabs(document.getElementById('hwtabs'), [['trackmate', 'Trackmate Interface'], ['ds', 'DS Electronics'], ['other', 'Other']], state.hwSub, id => { state.hwSub = id; renderHardwareArea(box); });
  if (state.hwSub === 'other') return;
  if (state.hwSub === 'ds') return renderDsSettings(document.getElementById('hwbox'));
  renderHardwareSettings(document.getElementById('hwbox'));
}

const GENERAL_FOLDERS = ['names', 'header', 'logo', 'data'];
async function renderGeneralSettings(box) {
  const S = state.settings, path = await api.dbPath(), hh = Banner.height(S), pos = Banner.pos(S), lpos = Banner.logoPos(S);
  const pic = !!S.homeHeader, logoOn = Banner.logoOn(S), hasLogo = !!S.clubLogo, side = Banner.logoSide(S), share = Banner.logoShare(S);
  // the page is made of folders, as the Results and Records page is: each opens and closes, the choice is remembered while the app runs
  const sf = (id, title, note, body) => folderHtml('general', id, title, note, `<div class="fbody">${body}</div>`);
  box.innerHTML = folderTools
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
    + sf('data', 'Database file', 'where everything is saved', `<div class="row"><span>Saved in:</span><code>${esc(path)}</code></div>`);
  folderWire(box);
  box.onclick = ev => { const fa = ev.target && ev.target.closest ? ev.target.closest('[data-folderall]') : null; if (fa) { folderAll('general', GENERAL_FOLDERS, fa.dataset.folderall === '1'); renderGeneralSettings(box); } };
  const $ = id => document.getElementById(id);
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
  box.innerHTML = `<p class="muted">Let tablets and phones on your wifi follow the race in a browser: race timing, leaderboard, driver stats and the other Live Race pages. They can only watch. The Race Director page needs the password below.</p>
    <div class="field"><label class="inline"><input id="net-on" type="checkbox" ${state.settings.netOn ? 'checked' : ''}> Share on my network</label></div>
    <div class="row"><label for="net-port">Port</label><input id="net-port" type="number" min="1" max="65535" value="${esc(state.settings.netPort || 8787)}" style="width:7em">
      <label for="net-pass">Password for the Race Director</label><input id="net-pass" type="text" maxlength="40" value="${esc(state.settings.netPassword || '')}" placeholder="none: the Race Director stays on this computer"></div>
    <div id="net-info"></div>`;
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
  view.onclick = null; view.onchange = null; // each screen sets up its own handlers
  LiveView.unmount();
  if (typeof live !== 'undefined' && live && live.leave && state.tab !== 'race') live.leave(); // the race screen is gone: no more keys, Trackmate or Race Director buttons
  renderTabs(tabsEl, TABS, state.tab, id => {
    if (id === 'live') { api.liveOpen(); return; } // Live Race is the second screen: it opens its own window, also during a race
    if (typeof raceActive === 'function' && raceActive()) { alert('Stop the race before leaving this screen.'); return; }
    if (typeof editorDirty === 'function' && editorDirty() && !confirm('Discard your unsaved layout changes?')) return;
    if (typeof editorLeave === 'function') editorLeave();
    state.tab = id; render();
  }, TAB_ICONS);
  try {
    if (state.tab === 'home') await renderHome();
    else if (state.tab === 'race') await renderRace();
    else if (state.tab === 'database') await renderDatabase();
    else if (state.tab === 'settings') await renderSettings();
    else if (state.tab === 'rules') await renderRules();
    else if (state.tab === 'setup') await renderSetup();
    else if (state.tab === 'custom') await renderCustom();
  } catch (e) { screenFailed(e); }
}

// A screen that cannot be drawn must never leave a dead page behind (the old page with its buttons switched off, as happened when a race could not be opened):
// it says what went wrong and offers the way back to Home.
function screenFailed(e) {
  console.error(e);
  if (state.tab === 'race') state.race = null; // (the race that could not be opened is not kept)
  view.onchange = null;
  view.innerHTML = `<section class="card" id="screenerror" role="alert"><h3>This screen could not be opened</h3><p>${esc(e && e.message ? e.message : e)}</p>
    <p class="muted">Nothing was lost: what was saved is still in the database. Go back to Home to carry on.</p><div class="row"><button class="btn primary" id="errhome">Back to Home</button></div></section>`;
  view.onclick = ev => { const b = ev.target && ev.target.closest ? ev.target.closest('#errhome') : null; if (b) { state.tab = 'home'; render(); } };
}

(async () => {
  state.schema = await api.schema();
  state.settings = await api.getSettings();
  applyTheme(); applyName();
  if (typeof location !== 'undefined' && location.hash === '#live') { // the second-screen window: only the Live Race pages
    document.body.classList.add('lv-window'); document.querySelector('header').hidden = true;
    document.title = (state.settings.appName || DEFAULT_NAME) + ' – Live Race'; return LiveView.mount(view, { second: true });
  }
  render();
  if (api.onHwChoose && typeof tmAutoConnect === 'function') tmAutoConnect(); // the remembered Trackmate, if it is plugged in
})();
