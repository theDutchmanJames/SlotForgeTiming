// App Settings > App Theme: choose a ready-made theme, or make your own colours. applyTheme paints the chosen theme on the page.

// the Custom theme's colours go on the page itself; every other theme comes from styles.css
function applyTheme() {
  const root = document.documentElement, t = state.settings.theme, custom = t === 'custom', c = Theme.customOf(state.settings);
  root.dataset.theme = Theme.THEMES.some(x => x[0] === t) ? t : 'dark';
  Theme.COLORS.forEach(([k]) => root.style.setProperty('--' + k, custom ? c[k] : '')); // '' takes the colour away again
  root.style.setProperty('--on-accent', custom ? Theme.onAccent(c.accent) : '');
  if (custom && Theme.isLight(c.panel)) root.dataset.tone = 'light'; else delete root.dataset.tone; // (light panels get the softer shadows of the depth, styles.css; the ready-made light themes say it there)
}
// the depth of the cards, buttons and widgets (App Settings > General > Display): the style sheet works with one number
function applyDepth() {
  document.documentElement.style.setProperty('--depth', String(Depth.factorOf(state.settings && state.settings.depth)));
}

// widgets on their own layers (App Settings > General > Performance): the style sheet looks at this one word on the page
function applyLayers() {
  document.documentElement.dataset.layers = Depth.layersOn(state.settings) ? 'on' : 'off';
}

// the colours of a ready-made theme, read from its tile on this screen (the tile carries that theme), so styles.css stays the only place they are written down
function themePalette(key) {
  const cs = getComputedStyle(document.querySelector(`[data-pick="${key}"]`));
  return Object.fromEntries(Theme.COLORS.map(([k]) => [k, Theme.hex6(cs.getPropertyValue('--' + k)) || Theme.DEFAULT[k]]));
}
const customVars = c => Theme.COLORS.map(([k]) => `--${k}:${c[k]}`).join(';') + `;--on-accent:${Theme.onAccent(c.accent)}`; // c holds checked colours only

function renderThemeSettings(box) {
  const current = state.settings.theme, colors = Theme.customOf(state.settings);
  const tile = ([k, name]) => `<button type="button" class="themetile" data-theme="${k}" data-pick="${k}" aria-pressed="${current === k}"${k === 'custom' ? ` style="${customVars(colors)}"` : ''}>
      <span class="themesw" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span>${current === k ? '✓ ' : ''}${esc(name)}</span></button>`;
  box.innerHTML = `<section data-settings-group="themes"><h3>Choose a theme</h3><p class="muted">Choose how the app looks. The theme is used on this computer and on tablets and phones that follow the race. Choose <em>Custom</em> to use your own colours, which you set below.</p>
    <div class="themegrid" role="group" aria-label="Theme">${Theme.THEMES.map(tile).join('')}</div>
    </section><section data-settings-group="colours"><h3>Your own colours</h3>
    <p class="muted">Click a colour to change it. The app changes while you choose, and switches to the Custom theme.</p>
    <div class="themecolors">${Theme.COLORS.map(([k, name, where]) => `<label class="colorrow"><input type="color" data-color="${k}" value="${colors[k]}" aria-label="${esc(name)}"><span><strong>${esc(name)}</strong><br><span class="muted">${esc(where)}</span></span></label>`).join('')}</div>
    <p class="error" id="th-warn" role="status">${esc(Theme.problems(colors).join(' '))}</p>
    <div class="row"><label for="th-from">Start from</label><select id="th-from">${Theme.THEMES.filter(t => t[0] !== 'custom').map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('')}</select><button type="button" class="btn" id="th-copy">Copy its colours</button></div></section>`;
  if (typeof AppSettingsPage !== 'undefined') AppSettingsPage.enhance(box, 'theme');
  const $ = id => document.getElementById(id);
  const save = async patch => { state.settings = await api.setSettings(patch); applyTheme(); renderThemeSettings(box); };
  box.onclick = async ev => {
    const b = ev.target.closest('[data-pick]');
    if (b) { // the first time Custom is chosen it starts from the theme you were looking at
      const k = b.dataset.pick;
      return save(k === 'custom' && !state.settings.customColors ? { theme: k, customColors: themePalette(Theme.THEMES.some(t => t[0] === current && t[0] !== 'custom') ? current : 'dark') } : { theme: k });
    }
    if (ev.target.id === 'th-copy' && (!state.settings.customColors || confirm('Replace your own colours with the colours of this theme?'))) save({ theme: 'custom', customColors: themePalette($('th-from').value) });
  };
  box.oninput = ev => { // while a colour is being chosen: show it straight away, save when the choice is made
    const k = ev.target.dataset && ev.target.dataset.color; if (!k) return;
    colors[k] = Theme.hex6(ev.target.value) || colors[k];
    state.settings = { ...state.settings, theme: 'custom', customColors: { ...colors } }; applyTheme();
    box.querySelector('[data-pick="custom"]').style.cssText = customVars(colors);
    $('th-warn').textContent = Theme.problems(colors).join(' ');
  };
  box.onchange = ev => { if (ev.target.dataset && ev.target.dataset.color) save({ theme: 'custom', customColors: { ...colors } }); };
}
