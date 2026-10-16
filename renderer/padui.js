// App Settings > Race Director (1.12.0): the values on the adjust pads of the Race Director page and of the race review, and how the pads are laid out.
// One list of values per group, for the whole app. The layout (horizontal or vertical) is kept on the device where it is chosen: on a phone or tablet it is that device's own choice.

function renderPadSettings(box) {
  const S = state.settings || {}, lay = AdjustPad.layoutOf(S), $ = id => document.getElementById(id);
  const field = g => `<div class="field" style="max-width:520px"><label for="pad-${g.id}">${esc(g.title)} <span class="muted">(${esc(g.note)})</span></label>
      <input id="pad-${g.id}" type="text" inputmode="decimal" autocomplete="off" data-padlist="${g.id}" value="${esc(AdjustPad.listText(AdjustPad.valuesOf(S, g.id)))}" aria-describedby="pad-${g.id}-hint">
      <span class="muted hint" id="pad-${g.id}-hint">Up to ${AdjustPad.MAXV} values, separated by commas. ${g.whole ? 'Whole numbers.' : 'Use a dot for decimals.'} The standard is ${esc(AdjustPad.listText(g.defaults))}.</span></div>`;
  box.innerHTML = `<p class="muted" style="max-width:70ch">The Race Director adds or takes off penalty points, race time, laps and championship points with pads: a <strong>+</strong> button, a value and a <strong>−</strong> button.
      Choose the values here. They are used on the Adjust folder of the Race Director page (during the race) and in the race review. Every pad also has a field for any other amount.</p>
    <h3>Values</h3>
    ${AdjustPad.GROUPS.map(field).join('')}
    <div class="row"><button type="button" class="btn" id="pad-reset">Back to the standard values</button></div>
    <h3>Layout</h3>
    <div class="row" role="group" aria-label="Layout of the pads">
      <button type="button" class="btn" data-padlayout="h" aria-pressed="${lay === 'h'}">Horizontal</button>
      <button type="button" class="btn" data-padlayout="v" aria-pressed="${lay === 'v'}">Vertical</button></div>
    <span class="muted hint">Horizontal: a column for every value, with the + buttons on top, the values in the middle and the − buttons below. Vertical: a row for every value, [+] value [−]. This is kept on this device.</span>
    <h3>Preview</h3>
    <div id="pad-preview" inert aria-hidden="true">${AdjustPad.padsHtml(S, {})}</div>`;
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
    const b = ev.target && ev.target.closest ? ev.target.closest('[data-padlayout],#pad-reset') : null; if (!b) return;
    if (b.id === 'pad-reset') { await save(Object.fromEntries(AdjustPad.GROUPS.map(g => [g.key, g.defaults.slice()]))); return renderPadSettings(box); }
    await save({ padLayout: b.dataset.padlayout === 'v' ? 'v' : 'h' });
    box.querySelectorAll('[data-padlayout]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.padlayout === AdjustPad.layoutOf(state.settings))));
  };
}
