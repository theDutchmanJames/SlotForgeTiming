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
        d.className = 'appdlg' + (o.danger ? ' appdlg-danger' : '');
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
  const api = {
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
