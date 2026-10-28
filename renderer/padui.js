// App Settings > Race Director (1.12.0): the values on the adjust pads of the Race Director page and of the race review, and how the pads are laid out.
// One list of values per group, for the whole app. The layout (horizontal or vertical) is kept on the device where it is chosen: on a phone or tablet it is that device's own choice.

function renderPadSettings(box) {
  const S = state.settings || {}, lay = AdjustPad.layoutOf(S), $ = id => document.getElementById(id), cards = typeof LaneCards === 'undefined' || LaneCards.on(S);
  const field = g => `<div class="field" style="max-width:520px"><label for="pad-${g.id}">${esc(g.title)} <span class="muted">(${esc(g.note)})</span></label>
      <input id="pad-${g.id}" type="text" inputmode="decimal" autocomplete="off" data-padlist="${g.id}" value="${esc(AdjustPad.listText(AdjustPad.valuesOf(S, g.id)))}" aria-describedby="pad-${g.id}-hint">
      <span class="muted hint" id="pad-${g.id}-hint">Up to ${AdjustPad.MAXV} values, separated by commas. ${g.whole ? 'Whole numbers.' : 'Use a dot for decimals (a comma also works: 0,5).'} The standard is ${esc(AdjustPad.listText(g.defaults))}.</span></div>`;
  box.innerHTML = `<section data-settings-group="view"><h3>Race Director view</h3><p class="muted" style="max-width:70ch">The Race Director adds or takes off penalty points, race time, laps and championship points with pads: a <strong>+</strong> button, a value and a <strong>−</strong> button.
      Choose the values here. One press of a <strong>+</strong> or <strong>−</strong> on a lane card adds or takes off the first (smallest) value; the other values, and a field for any other amount, are in the pop-up that opens when you click the number. The same values are used on the Adjust folder (the folders view) and in the race review.
      Existing race setups with their own pad values continue to use those values for that pad, and these values for the rest.</p>
    <div class="row padview" role="group" aria-label="Race Director view">
      <button type="button" class="btn" data-dview="cards" aria-pressed="${cards}">Lane cards</button>
      <button type="button" class="btn" data-dview="folders" aria-pressed="${!cards}">Folders</button></div>
    <span class="muted hint">Lane cards: one card for each lane with its pads, penalties, damage, failure and Balance of Power, so two to four lanes fit on the screen without scrolling (a phone shows one lane at a time). Folders: the folders Adjust, Penalties, Balance of Power, Damage and Car Failures, as before. The change counts from the next race (and when the Race Director page is opened again). This is kept on this device.</span>
    </section><section data-settings-group="values"><h3>Values</h3>
    ${AdjustPad.GROUPS.map(field).join('')}
    <div class="row"><button type="button" class="btn" id="pad-reset">Back to the standard values</button></div>
    </section><section data-settings-group="layout"><h3>Layout</h3>
    <div class="row" role="group" aria-label="Layout of the pads">
      <button type="button" class="btn" data-padlayout="h" aria-pressed="${lay === 'h'}">Horizontal</button>
      <button type="button" class="btn" data-padlayout="v" aria-pressed="${lay === 'v'}">Vertical</button></div>
    <span class="muted hint">Horizontal: a column for every value, with the + buttons on top, the values in the middle and the − buttons below. Vertical: a row for every value, [+] value [−]. This is kept on this device.</span>
    </section><section data-settings-group="preview"><h3>Preview</h3>
    <div id="pad-preview" inert aria-hidden="true">${AdjustPad.padsHtml(S, {})}</div></section>`;
  if (typeof AppSettingsPage !== 'undefined') AppSettingsPage.enhance(box, 'director');
  const preview = () => { $('pad-preview').innerHTML = AdjustPad.padsHtml(state.settings || {}, {}); };
  const save = async patch => { state.settings = await api.setSettings(patch); preview(); };
  box.onchange = async ev => {
    const inp = ev.target && ev.target.closest ? ev.target.closest('[data-padlist]') : null; if (!inp) return;
    const g = AdjustPad.byId(inp.dataset.padlist); if (!g) return;
    const list = AdjustPad.clean(g.id, inp.value);
    inp.value = AdjustPad.listText(list); // (what is kept: sorted, without doubles and mistakes)
    await save({ [g.key]: list });
  };
  box.onclick = async ev => {
    const v = ev.target && ev.target.closest ? ev.target.closest('[data-dview]') : null;
    if (v && v.dataset && v.dataset.dview) { // the Race Director view: lane cards or the folders
      state.settings = await api.setSettings({ directorView: v.dataset.dview === 'folders' ? 'folders' : 'cards' });
      box.querySelectorAll('[data-dview]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.dview === (state.settings.directorView === 'folders' ? 'folders' : 'cards'))));
      return;
    }
    const b = ev.target && ev.target.closest ? ev.target.closest('[data-padlayout],#pad-reset') : null; if (!b) return;
    if (b.id === 'pad-reset') { await save(Object.fromEntries(AdjustPad.GROUPS.map(g => [g.key, g.defaults.slice()]))); return renderPadSettings(box); }
    await save({ padLayout: b.dataset.padlayout === 'v' ? 'v' : 'h' });
    box.querySelectorAll('[data-padlayout]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.padlayout === AdjustPad.layoutOf(state.settings))));
  };
}
