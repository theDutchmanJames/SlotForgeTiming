// The app's own dialogs, in place of the browser's confirm() and alert(): they look like the app, do not stop the window,
// name their buttons, and put the focus on Cancel for an action that cannot be undone.
//   if (!(await Dialog.confirm('Delete this driver?', { ok: 'Delete', danger: true }))) return;
//   await Dialog.alert('Connect the DS box first.');
// A message is plain text; a blank line starts a new paragraph. One dialog at a time: a second one waits for the first.
// Without a real page (node tests with a stand-in document) the browser's confirm()/alert() are used, so a test's stand-ins still answer.
(function (root) {
  let queue = Promise.resolve();
  const real = () =>
    typeof document !== 'undefined' &&
    typeof root.HTMLDialogElement === 'function' &&
    typeof root.HTMLDialogElement.prototype.showModal === 'function' &&
    !!document.body;
  function paragraphs(text) {
    const box = document.createDocumentFragment();
    String(text ?? '')
      .split(/\n\s*\n/)
      .forEach(part => {
        const p = document.createElement('p');
        part.split('\n').forEach((line, i) => {
          if (i) p.appendChild(document.createElement('br'));
          p.appendChild(document.createTextNode(line));
        });
        box.appendChild(p);
      });
    return box;
  }
  // kind: 'confirm' (two buttons, resolves true/false) or 'alert' (one button, resolves undefined)
  function show(kind, message, o = {}) {
    if (!real()) {
      // (no page to draw on: the browser's own, or a test's stand-in)
      if (kind === 'confirm') return Promise.resolve(typeof root.confirm === 'function' ? !!root.confirm(message) : true);
      if (typeof root.alert === 'function') root.alert(message);
      return Promise.resolve();
    }
    const run = () =>
      new Promise(resolve => {
        const d = document.createElement('dialog');
        d.className = 'appdlg appdlg-' + kind + (o.danger ? ' appdlg-danger' : ''); // (Flag Dialog, 2.4.0: the kind picks the badge in front of the title)
        d.setAttribute('aria-labelledby', 'appdlg-title');
        const title = document.createElement('h3');
        title.id = 'appdlg-title';
        title.textContent = o.title || (kind === 'confirm' ? (o.danger ? 'Are you sure?' : 'Please confirm') : 'SlotForge Timing');
        const body = document.createElement('div');
        body.className = 'appdlg-body';
        body.appendChild(paragraphs(message));
        const row = document.createElement('div');
        row.className = 'row appdlg-buttons';
        const okBtn = document.createElement('button');
        okBtn.type = 'button';
        okBtn.className = 'btn ' + (o.danger ? 'danger' : 'primary');
        okBtn.textContent = o.ok || 'OK';
        let cancelBtn = null;
        if (kind === 'confirm') {
          cancelBtn = document.createElement('button');
          cancelBtn.type = 'button';
          cancelBtn.className = 'btn';
          cancelBtn.textContent = o.cancel || 'Cancel';
          row.append(cancelBtn, okBtn);
        } else row.append(okBtn);
        d.append(title, body, row);
        const before = document.activeElement;
        let done = false;
        const finish = answer => {
          if (done) return;
          done = true;
          d.close();
          d.remove();
          if (before && before.isConnected && typeof before.focus === 'function') before.focus();
          resolve(kind === 'confirm' ? answer : undefined);
        };
        okBtn.onclick = () => finish(true);
        if (cancelBtn) cancelBtn.onclick = () => finish(false);
        d.addEventListener('cancel', ev => {
          ev.preventDefault(); // Escape: the same as Cancel (or OK for a message)
          finish(false);
        });
        document.body.appendChild(d);
        d.showModal();
        (o.danger && cancelBtn ? cancelBtn : okBtn).focus();
      });
    const next = queue.then(run, run);
    queue = next.catch(() => {});
    return next;
  }
  // (2.5.2) a question with a few answers as Choice Rows (o.choices: [{ value, label, note, ok }], the first is picked to begin with); the value of the
  // one picked, or null for Cancel. Without a page to draw on: the browser's own yes/no for the first answer.
  function choose(message, o = {}) {
    const list = Array.isArray(o.choices) ? o.choices.filter(c => c && c.label) : [];
    if (!list.length) return Promise.resolve(null);
    if (!real())
      return Promise.resolve(typeof root.confirm === 'function' && !root.confirm(message + ' ' + list[0].label) ? null : list[0].value);
    const run = () =>
      new Promise(resolve => {
        const d = document.createElement('dialog');
        d.className = 'appdlg appdlg-confirm appdlg-choose' + (o.danger ? ' appdlg-danger' : '');
        d.setAttribute('aria-labelledby', 'appdlg-title');
        const title = document.createElement('h3');
        title.id = 'appdlg-title';
        title.textContent = o.title || 'Please choose';
        const body = document.createElement('div');
        body.className = 'appdlg-body';
        if (message) body.appendChild(paragraphs(message));
        const rows = document.createElement('div');
        rows.className = 'appdlg-choices';
        rows.setAttribute('role', 'radiogroup');
        let picked = 0;
        const okBtn = document.createElement('button');
        okBtn.type = 'button';
        okBtn.className = 'btn ' + (o.danger ? 'danger' : 'primary');
        const buttons = list.map((c, i) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'appdlg-choice';
          b.setAttribute('role', 'radio');
          b.dataset.value = String(c.value);
          const t = document.createElement('b');
          t.textContent = c.label;
          b.appendChild(t);
          if (c.note) {
            const n = document.createElement('small');
            n.textContent = c.note;
            b.appendChild(n);
          }
          b.onclick = () => pick(i);
          b.ondblclick = () => finish(c.value);
          return b;
        });
        const pick = i => {
          picked = i;
          buttons.forEach((b, k) => {
            b.classList.toggle('on', k === i);
            b.setAttribute('aria-checked', String(k === i));
            b.tabIndex = k === i ? 0 : -1; // (a radio group is one Tab stop; the arrows move inside it)
          });
          okBtn.textContent = list[i].ok || o.ok || list[i].label;
        };
        rows.append(...buttons);
        body.appendChild(rows);
        const row = document.createElement('div');
        row.className = 'row appdlg-buttons';
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn';
        cancelBtn.textContent = o.cancel || 'Cancel';
        row.append(cancelBtn, okBtn);
        d.append(title, body, row);
        const before = document.activeElement;
        let done = false;
        const finish = answer => {
          if (done) return;
          done = true;
          d.close();
          d.remove();
          if (before && before.isConnected && typeof before.focus === 'function') before.focus();
          resolve(answer);
        };
        okBtn.onclick = () => finish(list[picked].value);
        cancelBtn.onclick = () => finish(null);
        d.addEventListener('cancel', ev => {
          ev.preventDefault();
          finish(null);
        });
        // (2.5.2) the keys of a radio group: the arrows move the choice, Enter on a choice answers with it
        if (rows.addEventListener)
          rows.addEventListener('keydown', ev => {
            const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[ev.key];
            if (step) {
              ev.preventDefault();
              pick((picked + step + list.length) % list.length);
              buttons[picked].focus();
            } else if (ev.key === 'Enter') {
              ev.preventDefault();
              if (ev.repeat) return; // (a held Enter, from the key that opened the question, is not an answer)
              const at = buttons.indexOf(document.activeElement);
              finish(list[at >= 0 ? at : picked].value); // (the choice that has the focus)
            }
          });
        pick(0);
        document.body.appendChild(d);
        d.showModal();
        buttons[0].focus();
      });
    const next = queue.then(run, run);
    queue = next.catch(() => {});
    return next;
  }
  const api = {
    choose,
    confirm: (message, options) => show('confirm', message, options),
    alert: (message, options) => show('alert', message, options),
    // how many are open or waiting (tests, and the unsaved-changes check before closing)
    get open() {
      return typeof document !== 'undefined' && document.querySelectorAll ? document.querySelectorAll('dialog.appdlg[open]').length : 0;
    }
  };
  root.Dialog = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
