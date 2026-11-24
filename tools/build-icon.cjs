'use strict';
// Make build/icon.png (1024 px, see-through corners) and build/icon.ico (16 to 256 px) from build/icon.svg.
// Run with: npx electron tools/build-icon.cjs. A build-maintenance tool only; it never loads main.js or opens an app database.
const { app, BrowserWindow } = require('electron'),
  fs = require('node:fs'),
  path = require('node:path');
const root = path.resolve(__dirname, '..'),
  svg = fs.readFileSync(path.join(root, 'build/icon.svg'), 'utf8');
app.disableHardwareAcceleration();
app.setPath('userData', fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'sf-icon-')));
const timer = setTimeout(() => app.exit(2), 20000);
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 300,
    height: 300,
    transparent: true,
    frame: false,
    webPreferences: { offscreen: true }
  });
  await win.loadURL('data:text/html,<body style="margin:0;background:transparent"></body>');
  const draw = n =>
    win.webContents.executeJavaScript(`(async () => {
      const img = new Image(); img.src = 'data:image/svg+xml;base64,' + ${JSON.stringify(Buffer.from(svg).toString('base64'))};
      await img.decode(); const c = document.createElement('canvas'); c.width = c.height = ${n};
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, ${n}, ${n});
      return c.toDataURL('image/png').split(',')[1];
    })()`);
  const png = async n => Buffer.from(await draw(n), 'base64');
  fs.writeFileSync(path.join(root, 'build/icon.png'), await png(1024));
  const sizes = [16, 24, 32, 48, 64, 128, 256],
    pics = [];
  for (const n of sizes) pics.push(await png(n));
  const head = Buffer.alloc(6 + 16 * sizes.length);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(sizes.length, 4);
  let at = head.length;
  sizes.forEach((n, i) => {
    const o = 6 + i * 16;
    head[o] = n === 256 ? 0 : n;
    head[o + 1] = n === 256 ? 0 : n;
    head.writeUInt16LE(1, o + 4);
    head.writeUInt16LE(32, o + 6);
    head.writeUInt32LE(pics[i].length, o + 8);
    head.writeUInt32LE(at, o + 12);
    at += pics[i].length;
  });
  fs.writeFileSync(path.join(root, 'build/icon.ico'), Buffer.concat([head, ...pics]));
  clearTimeout(timer);
  app.exit(0);
});
