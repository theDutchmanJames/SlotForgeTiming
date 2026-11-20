// Customization › Widget Builder as a Widget Workshop (2.4.0, SlotForgeRestyle.md "Widget Workshop"): the widgets as cards on a race screen with where they are
// used, Add to a layout…, the layouts that use a widget brought up to date when it is saved, and one editor with a Simple / Canvas switch.
// The links between a widget and its copies are worked out by widgetlinks.js; the editors stay in widgetbuilder.js (Simple) and widgetstudio.js (Canvas).
let wwFilter = 'all';
const WW_U = 1000;
async function wwLists() {
  const [layouts, rowdesigns] = await Promise.all([api.list('layouts').catch(() => []), api.list('rowdesigns').catch(() => [])]);
  return { layouts, rowdesigns };
}
const wwPerLane = r => !!(r.composition ? r.type !== 'textrace' : Widgets.def(r.type)?.perLane);
// the list: a card for every widget, on a dark race screen, with its kind, where it is used, Edit and Add to a layout…
async function wwRenderList(box, list) {
  const lists = await wwLists(),
    usage = new Map(list.map(r => [r.id, WidgetLinks.usage(r, lists, wbToWidget)]));
  const counts = { all: list.length, lane: list.filter(wwPerLane).length, race: list.filter(r => !wwPerLane(r)).length };
  const shown = list.filter(r => wwFilter === 'all' || (wwFilter === 'lane') === wwPerLane(r));
  const kindOf = r =>
    `${wwPerLane(r) ? 'Per driver' : 'Once on screen'} · ${r.composition ? 'canvas' : (r.type || '').startsWith('image') ? 'picture' : 'text'}`;
  const card = r => {
    const u = usage.get(r.id) || [],
      w = wbToWidget(r, 0);
    // (2.4.0, "Try It") a text with a word it does not know says so on its card, as the Layout Editor does
    const unknown = typeof LayoutCheck !== 'undefined' ? LayoutCheck.unknownWords(w) : [],
      warn = unknown.length
        ? `<small class="wk-warn" role="note">⚠ ${esc(LayoutCheck.advice(unknown[0], w.type))}${unknown.length > 1 ? ` (+${unknown.length - 1} more)` : ''}</small>`
        : '';
    return `<article class="wk-card" data-ww="${esc(r.id)}"><div class="wk-stage"><span class="wk-kind">${esc(kindOf(r))}</span><div class="wk-sample" style="width:${Math.min(240, Number(r.w) || 240)}px;height:${Math.min(110, Number(r.h) || 60)}px;--lane:${wbLaneColour(0)}">${Widgets.sampleOf(Widgets.def(r.type), 0, w)}</div></div><div class="wk-body"><h3>${esc(r.name || 'Widget')}</h3><small>${u.length ? `${Icons.svg('layers', { size: 13, stroke: 1.8 })}Used in <b>${u.length} ${u.length === 1 ? 'layout' : 'layouts'}</b> · ${esc(u.map(x => x.name).join(', '))}` : 'Not in a layout yet'}</small>${warn}</div><div class="wk-foot"><button type="button" class="btn sm" data-edit="${esc(r.id)}">Edit</button><button type="button" class="btn sm${u.length ? '' : ' primary'}" data-ww-add="${esc(r.id)}">Add to a layout…</button><button type="button" class="btn sm ghost icon wk-m" data-ww-more="${esc(r.id)}" aria-haspopup="menu" aria-label="More for ${esc(r.name || 'this widget')}" title="More">⋯</button></div></article>`;
  };
  box.innerHTML = `<div class="wk"><div class="wk-strip"><button class="btn primary" id="newwb">＋ New widget</button><div class="gx-chips" role="group" aria-label="Show">${[
    ['all', 'All'],
    ['lane', 'Per driver'],
    ['race', 'Once on screen']
  ]
    .map(
      ([k, l]) =>
        `<button type="button" class="gx-chip${wwFilter === k ? ' on' : ''}" data-ww-filter="${k}" aria-pressed="${wwFilter === k}">${l}<small>${counts[k]}</small></button>`
    )
    .join(
      ''
    )}</div></div><div class="wk-grid">${shown.map(card).join('')}<div class="wk-new"><b>New widget</b><span>Start simple (a line of text or a picture), or draw it freely on a canvas.</span><div class="row"><button type="button" class="btn" data-ww-new="simple">Simple</button><button type="button" class="btn" data-ww-new="canvas">Canvas</button></div></div></div></div>`;
  const reload = () => box.isConnected !== false && renderWidgetBuilder(box);
  box.onclick = async ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    const q = b.dataset;
    if (b.id === 'newwb' || q.wwNew) {
      wbEd =
        q.wwNew === 'canvas'
          ? {
              id: null,
              draft: { name: 'New widget', type: 'textlane', w: 420, h: 240, composition: WidgetCompose.freeTemplate('blank') },
              dirty: true
            }
          : { id: null, draft: wbNew(), dirty: true };
      return renderWidgetBuilder(box);
    }
    if (q.wwFilter) {
      wwFilter = q.wwFilter;
      return reload();
    }
    const r = list.find(x => x.id === (q.edit || q.wwAdd || q.wwMore));
    if (!r) return;
    if (q.edit) {
      wbEd = { id: r.id, draft: wwOwn(r), dirty: false, saved: clone(r) };
      return renderWidgetBuilder(box);
    }
    if (q.wwAdd) return wwAddDialog(r, reload);
    if (q.wwMore)
      return garageMenu(
        b,
        [{ act: 'dup', label: 'Duplicate' }, '-', { act: 'del', label: 'Delete…', danger: true, note: 'Layouts keep their copy' }],
        async act => {
          if (act === 'dup') {
            await api.add('customwidgets', { ...wwOwn(r), name: r.name + ' (copy)' });
            return reload();
          }
          if (
            act === 'del' &&
            (await Dialog.confirm(`Delete the widget "${r.name}"?\n\nLayouts that use it keep their copy.\n\nThis can't be undone.`, {
              ok: 'Delete',
              danger: true
            }))
          ) {
            await api.remove('customwidgets', r.id);
            reload();
          }
        }
      );
  };
}
const wwOwn = r =>
  clone({
    name: r.name,
    type: r.type,
    text: r.text,
    image: r.image,
    fit: r.fit,
    rules: r.rules,
    w: r.w,
    h: r.h,
    textSize: r.textSize,
    valueBold: r.valueBold,
    valueItalic: r.valueItalic,
    composition: r.composition
  });
// a small picture of a layout: its widgets as boxes, the copies of this widget in blue
function wwMini(l, r) {
  const ratio = (Number(l.ratioH) || 9) / (Number(l.ratioW) || 16),
    H = WW_U * ratio;
  return `<div class="wk-mini" style="aspect-ratio:${(1 / ratio).toFixed(3)}">${(l.widgets || [])
    .slice(0, 60)
    .map(
      w =>
        `<i class="${WidgetLinks.isCopy(w, r, wbToWidget) ? 'me' : ''}" style="left:${(100 * w.x) / WW_U}%;top:${(100 * w.y) / H}%;width:${(100 * w.w) / WW_U}%;height:${(100 * w.h) / H}%"></i>`
    )
    .join('')}</div>`;
}
// Add to a layout…: choose a layout; the widget is put at its top left (the Layout Editor moves it)
async function wwAddDialog(r, done) {
  const { layouts } = await wwLists();
  if (!layouts.length) return Dialog.alert('There is no layout yet. Make one in the Layout Editor first.');
  let pick = (layouts.find(l => !(l.widgets || []).some(w => WidgetLinks.isCopy(w, r, wbToWidget))) || layouts[0]).id;
  const d = document.createElement('dialog');
  d.className = 'appdlg wk-win';
  const draw = () => {
    d.innerHTML = `<div class="wk-whd"><small>${esc(r.name || 'Widget')}</small><h2>Add to a layout</h2></div><div class="wk-lays">${layouts
      .map(l => {
        const n = (l.widgets || []).filter(w => WidgetLinks.isCopy(w, r, wbToWidget)).length;
        return `<button type="button" class="wk-lay${l.id === pick ? ' on' : ''}" data-ww-pick="${esc(l.id)}" aria-pressed="${l.id === pick}">${wwMini(l, r)}<b>${esc(l.name || 'Layout')}</b><small>${n ? `has it${n > 1 ? ' ' + n + '×' : ''}` : 'add it here'}</small></button>`;
      })
      .join(
        ''
      )}</div><p class="muted wk-note">${wwPerLane(r) ? 'A per-driver widget is added for the next lane that does not have it yet; ' : ''}it goes to the top left of the layout. Move it in the Layout Editor.</p><div class="row appdlg-buttons"><button type="button" class="btn" data-ww-cancel>Cancel</button><button type="button" class="btn primary" data-ww-ok>Add to ${esc((layouts.find(l => l.id === pick) || {}).name || 'the layout')}</button></div>`;
  };
  draw();
  document.body.appendChild(d);
  d.showModal();
  d.onclick = async ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.wwPick) {
      pick = b.dataset.wwPick;
      return draw();
    }
    if (b.hasAttribute('data-ww-cancel')) return d.close();
    if (b.hasAttribute('data-ww-ok')) {
      const l = layouts.find(x => x.id === pick),
        H = WW_U * ((Number(l.ratioH) || 9) / (Number(l.ratioW) || 16));
      const widgets = WidgetLinks.addTo(l.widgets, r, wbToWidget, { perLane: wwPerLane(r), width: WW_U, height: H, lanes: Widgets.LANES });
      try {
        await api.update('layouts', l.id, { widgets });
        d.close();
        done && done();
      } catch (e) {
        Dialog.alert('It could not be added: ' + e.message);
      }
    }
  };
  d.onclose = () => d.remove();
}
// after a save: the layouts that use the widget follow it (when you say so)
async function wwAfterSave(r, before, say) {
  try {
    const lists = await wwLists(),
      was = before ? { ...before, id: r.id } : r;
    const used = WidgetLinks.usage(was, lists, wbToWidget);
    if (!used.length) return say && say('Saved. Use Add to a layout… on its card to put it on a race screen.');
    const names = used.map(u => u.name);
    const ok = await Dialog.confirm(
      `${names.join(', ')} ${used.length === 1 ? 'uses' : 'use'} this widget.\n\nUpdate ${used.length === 1 ? 'it' : 'them'} now? Their place and size on the screen stay.`,
      {
        title: 'Update the layouts',
        ok: `Update ${used.length} ${used.length === 1 ? 'layout' : 'layouts'}`,
        cancel: 'Keep their copies'
      }
    );
    if (!ok) return say && say('Saved. The layouts keep their own copy.');
    let n = 0;
    for (const u of used) {
      const l = lists[u.kind].find(x => x.id === u.id),
        res = WidgetLinks.updateCopies(l.widgets, r, wbToWidget, was);
      if (res.changed || res.widgets.some(w => w.src === r.id)) {
        await api.update(u.kind, l.id, { widgets: res.widgets });
        n++;
      }
    }
    say && say(`Saved · ${n} ${n === 1 ? 'layout' : 'layouts'} updated.`);
  } catch (e) {
    say && say('Saved, but the layouts could not be updated: ' + e.message);
  }
}
// one editor, two ways: the Simple / Canvas switch beside Save (it is put back whenever an editor draws its header again)
function wwModeSwitch(box) {
  if (!wbEd || !box || !box.querySelector) return;
  const end = box.querySelector('.pitboard .pb-end');
  if (!end || end.querySelector('.wk-mode')) return;
  const canvas = !!wbEd.draft.composition;
  const el = document.createElement('span');
  el.className = 'wk-mode';
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', 'How the widget is made');
  el.innerHTML = `<button type="button" class="${canvas ? '' : 'on'}" data-ww-mode="simple" aria-pressed="${!canvas}">Simple</button><button type="button" class="${canvas ? 'on' : ''}" data-ww-mode="canvas" aria-pressed="${canvas}">Canvas</button>`;
  end.prepend(el);
  if (wbEd.id) {
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'btn';
    add.textContent = 'Add to a layout…';
    add.title = 'Put the saved widget on a race screen';
    add.onclick = async () => {
      const r = (await api.list('customwidgets')).find(x => x.id === wbEd.id);
      if (!r) return;
      if (wbEd.dirty) Dialog.alert('The saved widget is added. Save first to add your latest changes.');
      wwAddDialog(r);
    };
    el.after(add);
  }
  el.onclick = async ev => {
    const b = ev.target.closest('[data-ww-mode]');
    if (!b || (b.dataset.wwMode === 'canvas') === !!wbEd.draft.composition) return;
    const next = b.dataset.wwMode === 'canvas' ? WidgetLinks.toCanvas(wbEd.draft) : WidgetLinks.toSimple(wbEd.draft);
    if (!next)
      return Dialog.alert(
        b.dataset.wwMode === 'canvas'
          ? 'A picture that changes with rules cannot become canvas blocks. Make a canvas widget and add a picture block instead.'
          : 'This canvas has more than one block (or a block with rules), so it cannot be a simple widget. Simple holds one line of text.'
      );
    wbEd.draft = next;
    wbEd.dirty = true;
    return renderWidgetBuilder(box);
  };
}
// the Widget Builder page: the switch follows the editor (the editors draw their header again on their own)
function wwWatch(box) {
  if (!box || box.__wwWatch || typeof MutationObserver === 'undefined') return;
  box.__wwWatch = new MutationObserver(() => wwModeSwitch(box));
  box.__wwWatch.observe(box, { childList: true, subtree: true });
}
