// Actual preload/IPC boundary on an isolated profile, never the user's database.
const { app } = require('electron');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const out = path.resolve(__dirname, '../../../outputs/sqlite-conversion');
fs.mkdirSync(out, { recursive: true });
app.setPath('appData', path.join(out, 'profile-' + process.pid));
app.disableHardwareAcceleration();
let done = false;
const timer = setTimeout(() => app.exit(2), 60000);
app.on('browser-window-created', (_, win) => {
  win.hide();
  const errors = [];
  win.webContents.on('preload-error', (_e, _file, error) => errors.push(error.message));
  win.webContents.on('did-finish-load', async () => {
    if (done || !win.webContents.getURL().endsWith('index.html')) return;
    done = true;
    const run = code => win.webContents.executeJavaScript('(async()=>{' + code + '})()');
    try {
      await new Promise(resolve => setTimeout(resolve, 400));
      const result = await run(`
        window.storageErrors=[];addEventListener('error',e=>storageErrors.push(e.message));
        const field=await api.addCustomField('drivers',{label:'Club',type:'text',group:'personal'});
        const driver=await api.add('drivers',{name:'Storage review',custom:{[field.id]:'SlotForge'}});
        await api.update('drivers',driver.id,{name:'Reviewed driver'});
        const fetched=await api.getRecord('drivers',driver.id);
        const car=await api.add('slotcars',{brand:'SlotForge',model:'Fixture',picture:'data:image/png;base64,AA=='});
        const local=await api.paddockLocalCars();
        const saved=await api.saveSession({date:'2026-11-03',standings:[]},[{carId:car.id,driverId:driver.id,time:5000}]);
        const session=await api.getRecord('sessions',saved);
        await api.removeSession(saved);
        await api.removeCustomField('drivers',field.id);
        const cleaned=await api.getRecord('drivers',driver.id);
        await api.remove('drivers',driver.id);await api.remove('slotcars',car.id);
        return {fetched,local,session,cleaned,remaining:await api.list('sessions'),errors:storageErrors};
      `);
      assert.equal(result.fetched.name, 'Reviewed driver');
      assert.equal(Object.values(result.fetched.custom)[0], 'SlotForge');
      assert.equal(result.local.length, 1);
      assert.equal(Object.hasOwn(result.local[0], 'picture'), false);
      assert(result.session.id);
      assert.deepEqual(result.cleaned.custom, {});
      assert.deepEqual(result.remaining, []);
      assert.deepEqual(result.errors, []);
      assert.deepEqual(errors, []);
      win.setContentSize(1200, 800);
      await run("state.tab='home';await render();");
      await new Promise(resolve => setTimeout(resolve, 150));
      fs.writeFileSync(path.join(out, 'home.png'), (await win.webContents.capturePage()).toPNG());
      fs.writeFileSync(path.join(out, 'electron-results.json'), JSON.stringify({ passed: true, result }, null, 2));
      console.log('STORAGE BOUNDARY ELECTRON PASS');
      clearTimeout(timer);app.exit(0);
    } catch (error) { console.error(error); clearTimeout(timer);app.exit(1); }
  });
});
require('../../main');
