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
  return {
    ready,
    dispose() {
      if (disposed) return;
      disposed = true;
      settle(false);
      if (!win.isDestroyed()) win.destroy();
    }
  };
}
module.exports = { create };
