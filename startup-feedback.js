'use strict';
const path = require('node:path');
// Script-free, no preload and no application IPC. It exists only while the
// asynchronous storage/bootstrap work prepares the real application window.
function create({ BrowserWindow, quit }) {
  const win = new BrowserWindow({
    width: 460,
    height: 270,
    useContentSize: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    show: false,
    autoHideMenuBar: true,
    title: 'Opening SlotForge Timing',
    icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: '#171c23',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  let disposed = false,
    settled = false,
    resolveReady;
  const ready = new Promise(resolve => {
    resolveReady = resolve;
  });
  const settle = value => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    resolveReady(value);
  };
  // A feedback-page failure must not leave database startup waiting forever.
  const timer = setTimeout(() => settle(false), 5000);
  win.on('close', event => {
    if (!disposed) {
      event.preventDefault();
      win.setTitle('Finishing database preparation…');
      quit();
    }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.once('ready-to-show', () => {
    if (disposed || win.isDestroyed()) return;
    win.show();
    setImmediate(() => {
      if (disposed || win.isDestroyed()) return;
      // A Windows launcher can pass SW_HIDE in STARTUPINFO, overriding the first
      // ShowWindow call. A second request honours the application's own choice.
      if (!win.isVisible()) win.show();
      settle(win.isVisible());
    });
  });
  win.once('closed', () => settle(false));
  // A feedback-page failure must not turn a successful database open into an
  // unhandled rejection. The main window remains the authority for startup.
  win.loadFile(path.join(__dirname, 'renderer', 'startup.html')).catch(() => settle(false));
  // (2.4.0) a long step says how far it is: the status line and the window title. The page stays script-free: the words are set with a
  // style from outside (the newest replaces the one before), and the title is the window's own.
  let shownCss = null,
    shownText = '';
  const status = text => {
    if (disposed || win.isDestroyed() || typeof text !== 'string' || text === shownText) return;
    shownText = text;
    win.setTitle(text ? 'Opening SlotForge Timing · ' + text : 'Opening SlotForge Timing');
    const css = text ? `.status{font-size:0}.status::after{content:${JSON.stringify(text)};font-size:12.5px}` : '';
    const before = shownCss;
    shownCss = null;
    if (before) win.webContents.removeInsertedCSS(before).catch(() => {});
    if (css)
      win.webContents
        .insertCSS(css)
        .then(key => {
          if (disposed || win.isDestroyed() || shownText !== text) return win.webContents.removeInsertedCSS(key).catch(() => {});
          shownCss = key;
        })
        .catch(() => {});
  };
  return {
    ready,
    status,
    dispose() {
      if (disposed) return;
      disposed = true;
      settle(false);
      if (!win.isDestroyed()) win.destroy();
    }
  };
}
module.exports = { create };
