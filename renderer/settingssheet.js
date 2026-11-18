// (2.4.0) Settings Sheet: every page of App Settings shows its settings as slim rows in quiet groups. A row has two halves: the name of the setting
// and one line about it on the left (the rest folds under "More"), its control on the right. The controls are one small family: a switch, a
// segmented choice, a list, a stepper for a number, a short text field, a file button, buttons for actions.
// The pages keep drawing their own controls; this moves them into rows. A control keeps its id and its handlers; a row keeps the class "field"
// and the hint keeps the class "hint", so code that looks for control.closest('.field').querySelector('.hint') still finds them.
const SettingsSheet = (() => {
  const isEl = n => n && n.nodeType === 1;
  const txt = e =>
    String((e && e.textContent) || '')
      .replace(/\s+/g, ' ')
      .trim();
  const CONTROL = 'input:not([type=hidden]),select,textarea';
  // (what is not a list of settings but a picture of something: a preview, the sensors of a track, a palette: it stays as it is drawn)
  const RAW =
    '.lanes,.tm-setup,.calc-rail,.ss-block-raw,[data-ss-raw],.tm-sensors,.tm-sensor,#pad-preview,.settings-pad-preview,.pad,.pad-grid,[class*="preview"],[class*="palette"],.theme-grid,.themegrid,.qr,canvas,svg';
  // (inside one of these nothing is turned into rows; the frame of a whole page is not one of them)
  const RAW_IN = RAW.replace('.lanes,.tm-setup,', '.lanes,');
  // (what is already part of a sheet, or never becomes one)
  const DONE = '.ss-sheet,.ss-gh,.ss-block,.ss-note,.ss-nest,.ss-fold,.ss-row,.ss-skip,.sr-tabsource,script,template,dialog,style';
  // true when a box has children that are not yet a sheet (a page that draws itself again later)
  const fresh = box => !!box && [...box.children].some(c => !c.matches(DONE) || (c.matches('.ss-nest') && fresh(c)));
  const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
  // the name of a setting and the words in brackets after it: "Interface size (the text…)" -> ["Interface size", "The text…"]
  const split = t => {
    const m = /^(.*?)\s*\((.+)\)\s*$/.exec(t);
    return m && m[1].length > 1 ? [m[1], cap(m[2])] : [t, ''];
  };
  // the text of a label without the text of the controls in it
  function labelText(label, skip) {
    let s = '';
    label.childNodes.forEach(n => {
      if (n === skip) return;
      if (n.nodeType === 3) s += n.textContent;
      else if (isEl(n) && !n.matches(CONTROL + ',output,button,.hint,small,img,.optimg') && !n.querySelector(CONTROL)) s += n.textContent;
    });
    return s.replace(/\s+/g, ' ').trim().replace(/:$/, '');
  }
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };
  // ---- the control kit ----
  const fire = (c, ...types) => types.forEach(t => c.dispatchEvent(new Event(t, { bubbles: true })));
  // a list of a few short options becomes a segmented choice that sets the list (the list stays, out of sight)
  function segmented(select) {
    const opts = [...select.options];
    if (select.multiple || opts.length < 2 || opts.length > 5 || opts.reduce((n, o) => n + txt(o).length, 0) > 64) return null;
    const seg = el('span', 'ss-seg');
    seg.setAttribute('role', 'group');
    const draw = () =>
      seg.querySelectorAll('button').forEach(b => {
        const on = b.dataset.v === select.value;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', String(on));
        b.disabled = select.disabled;
      });
    opts.forEach(o => {
      const b = el('button', '', '');
      b.type = 'button';
      b.dataset.v = o.value;
      b.textContent = txt(o).replace(/\s*\((standard|large|very large)\)$/i, '');
      b.title = txt(o);
      b.onclick = () => {
        if (select.value === o.value) return;
        select.value = o.value;
        draw();
        fire(select, 'input', 'change');
      };
      seg.append(b);
    });
    select.classList.add('ss-hidden');
    select.addEventListener('change', draw);
    draw();
    return seg;
  }
  // a number (or what was a slider) gets − and + beside it; a slider becomes a number
  function stepper(input, unit = '') {
    if (input.type === 'range') {
      input.type = 'number';
      input.classList.add('ss-wasrange');
    }
    const box = el('span', 'ss-step');
    const step = d => {
      if (input.disabled) return;
      try {
        d > 0 ? input.stepUp() : input.stepDown();
      } catch {
        input.value = String((Number(input.value) || 0) + d * (Number(input.step) || 1));
      }
      fire(input, 'input', 'change');
    };
    const minus = el('button', 'ss-stepb', '−'),
      plus = el('button', 'ss-stepb', '+');
    minus.type = plus.type = 'button';
    minus.setAttribute('aria-label', 'Less');
    plus.setAttribute('aria-label', 'More');
    minus.tabIndex = plus.tabIndex = -1;
    minus.onclick = () => step(-1);
    plus.onclick = () => step(1);
    input.replaceWith(box);
    box.append(minus, input, plus);
    if (unit) box.append(el('span', 'ss-unit', unit));
    const sync = () => box.classList.toggle('off', !!input.disabled);
    sync();
    new MutationObserver(sync).observe(input, { attributes: true, attributeFilter: ['disabled'] });
    return box;
  }
  // one control, made to fit the kit; returns what goes into the right half
  function kit(c, unit) {
    if (c.matches('select')) return segmented(c) || (c.classList.add('ss-select'), c);
    if (c.matches('input[type=number],input[type=range]')) return stepper(c, unit);
    if (c.matches('input[type=checkbox]')) return (c.classList.add('ss-switch'), c);
    if (c.matches('input[type=file]')) return (c.classList.add('ss-file'), c);
    if (c.matches('input[type=text],input[type=search],input[type=password],input:not([type])')) return (c.classList.add('ss-text'), c);
    return c;
  }
  // ---- a row ----
  let rowIds = 0;
  function row({ title, desc, hint, ctl = [], cls = '' }) {
    const r = el('div', 'field ss-row' + (cls ? ' ' + cls : ''));
    const t = el('div', 'ss-t');
    if (title) t.append(el('b', '', esc(title)));
    if (desc) t.append(el('span', 'ss-desc', esc(desc)));
    (hint ? [].concat(hint) : []).forEach(h => {
      h.classList.add('hint', 'ss-hint');
      t.append(h);
    });
    const c = el('div', 'ss-ctl');
    ctl.filter(Boolean).forEach(n => c.append(n));
    r.append(t, c);
    if (!c.childNodes.length) r.classList.add('ss-noctl');
    // (2.4.0) the label of the page is gone: the name of the row names its controls for a screen reader
    const name = title && t.querySelector(':scope > b');
    if (name && typeof c.querySelectorAll === 'function') {
      name.id = name.id || 'ss-n' + ++rowIds;
      c.querySelectorAll('input,select,textarea,.ss-seg').forEach(x => {
        if (typeof x.hasAttribute === 'function' && !x.hasAttribute('aria-label') && !x.hasAttribute('aria-labelledby'))
          x.setAttribute('aria-labelledby', name.id);
      });
    }
    return r;
  }
  const unitOf = out => {
    const m = /%|°|s\b|px/.exec(txt(out));
    return m ? m[0] : '';
  };
  const isHint = n =>
    isEl(n) && (n.matches('.hint,span.muted,small.muted,p.muted,p.hint') || (n.matches('p') && !n.querySelector(CONTROL + ',button')));
  // a label with its control in it, or for= its control: one row
  function labelRow(label, scope) {
    const ctl = label.control || (label.htmlFor && scope.querySelector('#' + CSS.escape(label.htmlFor))) || label.querySelector(CONTROL);
    if (!ctl) return null;
    const isBox = ctl.matches('input[type=checkbox]') && label.contains(ctl);
    const sub = label.querySelector(':scope > small, :scope > span.muted, :scope > em');
    let [title, desc] = split(labelText(label, sub));
    if (sub && !desc) desc = cap(txt(sub));
    // (a name in bold and a quiet line under it, both inside the label)
    const nm = label.querySelector('strong, b'),
      qt = label.querySelector('.muted, small');
    if (nm && qt && !nm.contains(ctl) && !qt.contains(ctl)) [title, desc] = [txt(nm), cap(txt(qt))];
    const out = (label.parentElement && label.parentElement.querySelector(`output[for="${ctl.id}"]`)) || label.querySelector('output');
    const unit = out ? unitOf(out) : '';
    if (out) out.classList.add('ss-hidden');
    const extras = [...label.querySelectorAll('button,.optimg,img')].filter(x => !x.closest('.ss-row'));
    const r = row({ title, desc, ctl: [...extras, kit(ctl, unit)], cls: isBox ? 'ss-switchrow' : '' });
    label.replaceWith(r);
    return r;
  }
  // ---- turn a container's children into groups of rows; what is too special for a row stays as it is, as a block ----
  function convert(box) {
    if (!isEl(box) || box.closest('.ss-block-raw')) return;
    let sheet = null,
      last = null;
    const flush = () => {
      sheet = null;
    };
    const into = (r, at) => {
      if (!sheet) {
        sheet = el('div', 'ss-sheet');
        at.before(sheet);
      }
      sheet.append(r);
      last = r;
    };
    [...box.children].forEach(n => {
      if (!n.isConnected || n.parentElement !== box) return;
      if (n.matches(DONE)) {
        if (n.matches('.ss-nest') && fresh(n)) convert(n);
        flush();
        return;
      }
      // a heading starts a new group
      if (n.matches('h3,h4,h5') && !n.querySelector(CONTROL)) {
        flush();
        n.classList.add('ss-gh');
        last = null;
        return;
      }
      // a hint under a row belongs to that row
      if (isHint(n) && last && last.isConnected && !last.querySelector('.ss-hint')) {
        n.classList.add('hint', 'ss-hint');
        last.querySelector('.ss-t').append(n);
        return;
      }
      // (a mark keeps the place: making the rows takes the child out of the page)
      const mark = document.createComment('');
      n.before(mark);
      const rows = rowsOf(n);
      if (rows) {
        const prev = mark.previousElementSibling;
        if (
          rows.length === 1 &&
          rows[0].matches('.ss-actions') &&
          prev &&
          prev.matches('p.ss-note') &&
          !prev.id &&
          prev.parentElement === box
        ) {
          rows[0].classList.remove('ss-actions');
          rows[0].querySelector('.ss-t').append(el('span', 'ss-desc', esc(txt(prev))));
          prev.remove();
        }
        rows.forEach(r => into(r, mark));
        mark.remove();
        if (n.isConnected && !n.children.length && !txt(n)) n.remove();
        return;
      }
      mark.remove();
      if (isHint(n)) {
        // words of their own: a quiet line in the group
        n.classList.add('ss-note');
        if (sheet) sheet.append(n);
        last = null;
        return;
      }
      flush();
      last = null;
      // a container with plain settings in it: its insides get rows too
      if (
        n.matches('div,section,fieldset,form') &&
        n.querySelector(CONTROL + ',button,h3,h4') &&
        !n.matches(RAW + ',.paddock-delivery,[class*=card],[class*=tile],[class*=item]')
      ) {
        n.classList.add('ss-nest');
        convert(n);
        // (a hint right after the box belongs to its last row)
        last = n.querySelector(':scope > .ss-sheet:last-child > .ss-row:last-child');
        return;
      }
      if (n.matches('details') && !n.classList.contains('sr-sec')) {
        n.classList.add('ss-fold');
        const inner = [...n.children].filter(c => !c.matches('summary'));
        const body = el('div', 'ss-foldbody');
        inner.forEach(c => body.append(c));
        n.append(body);
        convert(body);
        return;
      }
      n.classList.add('ss-block');
    });
    box.dataset.ss = '1';
  }
  // the rows a child makes, or null when it is not a plain setting
  function rowsOf(n) {
    if (!isEl(n) || n.closest('.ss-row') || n.matches(RAW) || (n.parentElement && n.parentElement.closest(RAW_IN))) return null;
    if (n.matches('.ss-row')) return [n];
    // a button on its own: a row of one action
    if (n.matches('button.btn,a.btn') && n.parentElement && !n.parentElement.matches('.ss-ctl')) {
      const r = row({ cls: 'ss-actions' });
      n.before(r);
      r.querySelector('.ss-ctl').append(n);
      r.classList.remove('ss-noctl');
      return [r];
    }
    // a label with a control
    if (n.matches('label') && (n.control || n.querySelector(CONTROL))) {
      const r = labelRow(n, n.parentElement || document);
      return r ? [r] : null;
    }
    // a field: its label, its control(s) and its hint
    if (n.matches('.field') && !n.matches('.ss-row')) {
      const controls = [...n.querySelectorAll(CONTROL)];
      if (!controls.length) return null;
      if (n.querySelector('table,canvas,svg:not(.ico),.lanes,[class*="grid"]') && controls.length > 3) return null;
      const label = n.querySelector(':scope > label');
      const subRows = [...n.querySelectorAll(':scope > .row')];
      // a field with one control: one row
      if (controls.length === 1 && !subRows.length) {
        const c = controls[0];
        const hints = [...n.querySelectorAll(':scope > .hint, :scope > span.muted, :scope > p.muted, :scope > small')];
        let title = '',
          desc = '';
        if (label) [title, desc] = split(labelText(label));
        const isBox = c.matches('input[type=checkbox]');
        const extras = [...n.querySelectorAll('button,.optimg')].filter(x => x !== c);
        const out = n.querySelector('output');
        if (out) out.classList.add('ss-hidden');
        const r = row({ title, desc, hint: hints, ctl: [...extras, kit(c, out ? unitOf(out) : '')], cls: isBox ? 'ss-switchrow' : '' });
        // (the id of the field, if any, goes with it)
        if (n.id) r.id = n.id;
        [...n.attributes].filter(a => a.name.startsWith('data-')).forEach(a => r.setAttribute(a.name, a.value));
        n.replaceWith(r);
        return [r];
      }
      // a field with more: its own small group, the label as its heading
      const rows = [];
      if (label && !label.querySelector(CONTROL) && !label.control) {
        const [title, desc] = split(labelText(label));
        const head = row({ title, desc, cls: 'ss-headrow' });
        label.replaceWith(head);
        rows.push(head);
      }
      [...n.children].forEach(c => {
        if (c.matches('.ss-row')) return rows.push(c);
        const rs = rowsOf(c);
        if (rs) rows.push(...rs);
        else if (isHint(c) && rows.length && !rows[rows.length - 1].querySelector('.ss-hint')) {
          c.classList.add('hint', 'ss-hint');
          rows[rows.length - 1].querySelector('.ss-t').append(c);
        } else if (isHint(c)) {
          c.classList.add('ss-note');
          rows.push(c);
        } else {
          c.classList.add('ss-block', 'ss-inrow');
          rows.push(c);
        }
      });
      n.remove();
      return rows;
    }
    // a row of controls: one row per labelled control; buttons alone are one row of actions
    if (n.matches('.row,.inline,.ambset,.audcool')) {
      const labels = [...n.querySelectorAll(':scope > label')];
      const loose = [...n.children].filter(c => !c.matches('label'));
      if (!labels.length && loose.every(c => c.matches('button,.btn,span,output,a,p,strong,b,small,select,input'))) {
        const strong = loose.find(c => c.matches('strong,b') && !c.querySelector('*'));
        const msg = loose.filter(c => c.matches('span,output,p,small') && !c.matches('.btn'));
        const btns = loose.filter(c => c.matches('button,.btn,a,select,input')).map(c => (c.matches(CONTROL) ? kit(c) : c));
        if (!btns.length) return null;
        // (buttons that choose one of a few, the chosen one primary or pressed: a segmented choice)
        const choice = btns.length >= 2 && btns.length <= 5 && !msg.length && btns.some(b => b.hasAttribute('aria-pressed'));
        if (choice) {
          const g = el('span', 'ss-seg ss-btnseg');
          btns.forEach(b => g.append(b));
          const name = strong ? txt(strong) : n.getAttribute('aria-label') || '';
          const r = row({ title: name, ctl: [g], cls: name ? '' : 'ss-actions' });
          if (strong) strong.remove();
          n.replaceWith(r);
          return [r];
        }
        // (no name, but one sentence that says what the buttons do: that sentence on the left)
        const say = !strong && msg.length === 1 && !msg[0].id && !msg[0].getAttribute('role') && txt(msg[0]).length > 24 ? msg[0] : null;
        if (say) {
          const r = row({ desc: txt(say), ctl: btns });
          n.replaceWith(r);
          return [r];
        }
        const r = row({ title: strong ? txt(strong) : '', ctl: [...msg, ...btns], cls: strong ? '' : 'ss-actions' });
        if (strong) strong.remove();
        n.replaceWith(r);
        return [r];
      }
      if (!labels.length) return null;
      const rows = [];
      const lead = n.querySelector(':scope > strong, :scope > b');
      if (lead && !lead.querySelector('*')) {
        const head = row({ title: txt(lead), cls: 'ss-headrow' });
        lead.replaceWith(head);
        rows.push(head);
      }
      [...n.children].forEach(c => {
        if (c.parentElement !== n) return; // (already taken into a row)
        if (c.matches('.ss-row')) return rows.push(c);
        if (c.matches('label')) {
          const r = labelRow(c, n);
          if (r) rows.push(r);
        } else if (c.matches('button,.btn')) {
          const prev = rows[rows.length - 1];
          if (prev && !prev.classList.contains('ss-actions')) prev.querySelector('.ss-ctl').append(c);
          else rows.push(row({ ctl: [c], cls: 'ss-actions' }));
        } else if (c.matches(CONTROL)) {
          rows.push(row({ ctl: [kit(c)] }));
        } else if (isHint(c) || c.matches('span,output')) {
          const prev = rows[rows.length - 1];
          if (prev) prev.querySelector('.ss-ctl').prepend(c);
        }
      });
      n.remove();
      return rows;
    }
    return null;
  }
  // a hint longer than one line folds; a small "More" opens it
  function folds(root) {
    if (!isEl(root)) return;
    root.querySelectorAll('.ss-hint:not([data-fold])').forEach(h => {
      if (!h.offsetParent && !h.closest('.ss-t').offsetParent) return; // (out of sight: measured when it is shown)
      h.dataset.fold = '1';
      // (under a description of its own the hint waits behind More; alone it shows one line, and More when there is more)
      const behind = h.previousElementSibling && h.previousElementSibling.classList.contains('ss-desc');
      if (!behind && h.scrollHeight <= h.clientHeight + 2) return;
      const b = el('button', 'ss-more', 'More');
      b.type = 'button';
      b.onclick = () => {
        const open = h.classList.toggle('open');
        b.textContent = open ? 'Less' : 'More';
      };
      h.after(b);
    });
  }
  // a dependent setting: the rows after a switch that need it, until the next switch (only where a page marks them, see dependents())
  function dependents(root) {
    if (!isEl(root)) return;
    root.querySelectorAll('.ss-row.ss-switchrow input.ss-switch').forEach(sw => {
      const r = sw.closest('.ss-row');
      const next = [];
      for (let s = r.nextElementSibling; s && s.classList.contains('ss-sub'); s = s.nextElementSibling) next.push(s);
      if (!next.length) return;
      const sync = () => next.forEach(x => x.classList.toggle('ss-off', !sw.checked));
      sw.addEventListener('change', sync);
      sync();
    });
  }
  return { fresh, convert, row, kit, segmented, stepper, folds, dependents, split, labelText };
})();
