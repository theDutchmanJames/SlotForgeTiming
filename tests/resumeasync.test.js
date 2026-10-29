// 1.60.0: the race save is written in the background (db.js saveResumeAsync / clearResumeAsync / resumeIdle): one at a time, in the order they came, only the newest of a few that
// pile up, a clear is never undone by an earlier save, and a slow disk does not make the program wait.
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const Database = require('../db.js');
let fails = 0;
const ok = (m, c) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const fresh = () => new Database(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'slt-ra-')), 'db.json'));
const snap = name => ({ v: 1, savedAt: '2026-10-20T10:00:00.000Z', name, race: { setup: { name }, track: { id: 't1' }, rows: [] }, eng: { status: 'running', cars: [] } });
const onDisk = db => { try { return JSON.parse(fs.readFileSync(db.resumeFile(), 'utf8')); } catch { return null; } };

(async () => {
  { const db = fresh();
    ok('a new database has nothing to write and nothing waiting', db.resumePending() === false && JSON.stringify(db.resumeStats()) === JSON.stringify({ writes: 0, lastMs: 0, maxMs: 0, failed: 0 }));
    await db.resumeIdle(); ok('...and "idle" answers at once', true);
    const p = db.saveResumeAsync(snap('Day race'));
    ok('a save is on its way as soon as it is asked for (the call itself returns a promise)', p instanceof Promise && db.resumePending() === true);
    ok('...and it is written, and answered with true', (await p) === true && onDisk(db).name === 'Day race' && db.resumePending() === false);
    ok('...no half-written file is left next to it', !fs.existsSync(db.resumeFile() + '.tmp') && fs.readdirSync(path.dirname(db.file)).every(f => !f.endsWith('.tmp')));
    ok('...what the old (waiting) read finds is the same', JSON.stringify(db.getResume()) === JSON.stringify(snap('Day race')));
    const st = db.resumeStats(); ok('the saving is counted, with how long the last and the slowest took', st.writes === 1 && st.lastMs >= 0 && st.maxMs >= st.lastMs && st.failed === 0); }

  { const db = fresh();
    ok('something that is not a snapshot is not written, and the answer is false', (await db.saveResumeAsync(null)) === false && (await db.saveResumeAsync({ v: 2 })) === false && (await db.saveResumeAsync('x')) === false && !fs.existsSync(db.resumeFile()));
    const circular = { v: 1 }; circular.me = circular; ok('...also not one that can not be turned into text', (await db.saveResumeAsync(circular)) === false && !fs.existsSync(db.resumeFile())); }

  { const db = fresh();
    const a = db.saveResumeAsync(snap('one')), b = db.clearResumeAsync();
    await Promise.all([a, b]);
    ok('a clear that comes right after a save is done after it: the file is gone (a save never brings it back)', onDisk(db) === null && !fs.existsSync(db.resumeFile()));
    const c = db.clearResumeAsync(), d = db.saveResumeAsync(snap('two'));
    await Promise.all([c, d]);
    ok('a save that comes after a clear is kept', onDisk(db) && onDisk(db).name === 'two');
    await db.clearResumeAsync(); await db.clearResumeAsync();
    ok('clearing twice, or with nothing kept, is fine', onDisk(db) === null); }

  { const db = fresh(), names = ['a', 'b', 'c', 'd', 'e', 'f'];
    const ps = names.map(n => db.saveResumeAsync(snap(n)));
    const answers = await Promise.all(ps);
    ok('six saves one after the other: the file holds the last one', onDisk(db).name === 'f');
    ok('...every one of them is answered, with true (also the ones that were replaced by a newer one)', answers.length === 6 && answers.every(x => x === true));
    ok('...and not every one of them was written (the first, and the newest after it)', db.resumeStats().writes >= 2 && db.resumeStats().writes <= 3);
    const e = db.saveResumeAsync(snap('g')), f = db.clearResumeAsync(), g = db.saveResumeAsync(snap('h'));
    await Promise.all([e, f, g]);
    ok('a save, a clear and a save: the file ends with the last save', onDisk(db).name === 'h');
    const h = db.saveResumeAsync(snap('i')), i = db.saveResumeAsync(snap('j')), j = db.clearResumeAsync();
    await Promise.all([h, i, j]);
    ok('two saves and a clear: the file is gone', onDisk(db) === null); }

  { const db = fresh();
    db.saveResumeAsync(snap('x1')); db.saveResumeAsync(snap('x2'));
    const read = db.resumeIdle().then(() => db.getResume());
    ok('a read that waits for the saves that are on their way sees the newest', (await read).name === 'x2');
    db.clearResumeAsync();
    ok('...and after a clear that is on its way it sees nothing', (await db.resumeIdle().then(() => db.getResume())) === null); }

  { const db = fresh(); const good = db.resumeFile;
    db.resumeFile = () => path.join(path.dirname(db.file), 'no-such-folder', 'race-resume.json');
    const bad = await db.saveResumeAsync(snap('lost'));
    ok('a save that can not be written is answered with false, and counted', bad === false && db.resumeStats().failed === 1 && db.resumePending() === false);
    db.resumeFile = good;
    ok('...and the next save works as always', (await db.saveResumeAsync(snap('back'))) === true && onDisk(db).name === 'back'); }

  { // a disk that takes a third of a second to flush: the program (this timer) goes on while it waits
    const db = fresh(), realOpen = fs.promises.open;
    fs.promises.open = async (...a) => { const fh = await realOpen(...a); const sync = fh.sync.bind(fh); fh.sync = async () => { await wait(300); return sync(); }; return fh; };
    let last = Date.now(), gap = 0, ticks = 0; const timer = setInterval(() => { const n = Date.now(); gap = Math.max(gap, n - last); last = n; ticks++; }, 10);
    const t0 = Date.now(); await db.saveResumeAsync(snap('slow')); const took = Date.now() - t0; clearInterval(timer); fs.promises.open = realOpen;
    ok('a slow disk: the save takes its time (a third of a second here)', took >= 280 && onDisk(db).name === 'slow');
    ok('...while the program went on: the timer kept ticking (about every 10 ms, never stuck for long)', ticks > 15 && gap < 100); }

  { // while the new file is being flushed, the old one is still whole: it is written next to it and put in its place afterwards
    const db = fresh(), realOpen = fs.promises.open;
    await db.saveResumeAsync(snap('before'));
    fs.promises.open = async (...a) => { const fh = await realOpen(...a); const sync = fh.sync.bind(fh); fh.sync = async () => { await wait(300); return sync(); }; return fh; };
    const p = db.saveResumeAsync(snap('after')); await wait(150);
    const mid = onDisk(db), tmpThere = fs.existsSync(db.resumeFile() + '.tmp');
    await p; fs.promises.open = realOpen;
    ok('while a save is being flushed the file of the race is still the old one, whole, and the new one waits next to it', !!mid && mid.name === 'before' && tmpThere);
    ok('...and when it is done the new one has taken its place (and no file is left next to it)', onDisk(db).name === 'after' && !fs.existsSync(db.resumeFile() + '.tmp'));
    await db.saveResumeAsync(snap('quick'));
    const st = db.resumeStats(); ok('the slowest save is remembered, also after a quick one (the last one is shorter)', st.maxMs >= 280 && st.lastMs < st.maxMs && st.writes === 3);
    st.writes = 99; st.maxMs = 99999; ok('...and the figures that are given out are a copy (changing them changes nothing)', db.resumeStats().writes === 3 && db.resumeStats().maxMs < 99999); }

  { // the files that use it
    const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
    ok('main.js routes resource checkpoints atomically while retaining background saves for normal races', main.includes("return resourceStore.save(snap)") && main.includes("return db.saveResumeAsync(snap)") && main.includes("await resourceStore.clear();return db.clearResumeAsync()") && main.includes("await resourceStore.idle();await db.resumeIdle();return resourceStore.ledger().checkpoint||db.getResume()"));
    ok('...and on closing, a save that is on its way (a race save, since 1.61.0 a settings file too) is written first (not for longer than three seconds)', /before-quit', e => \{[\s\S]*db\.writesPending\(\)[\s\S]*e\.preventDefault\(\)[\s\S]*3000[\s\S]*app\.quit\(\)/.test(main)); }

  { // closing the program (the real lines of main.js, with a stand-in for the app and the database)
    const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8'), code = main.slice(main.indexOf('let quitFlushed = false;'));
    const setup = (pending, idle, pluginHost = null) => {
      const handlers = {}, calls = { quit: 0, prevented: 0, closed: 0 }, timers = [];
      vm.runInNewContext(code, { pluginHost, phidget: { shutdown() {} }, app: { on: (ev, f) => { handlers[ev] = f; }, quit: () => { calls.quit++; } }, net: { server: { close: () => { calls.closed++; } } }, db: { writesPending: pending, writesIdle: idle }, Promise, setTimeout: (f, ms) => { timers.push({ f, ms }); return timers.length; } });
      return { calls, timers, fire() { handlers['before-quit']({ preventDefault: () => { calls.prevented++; } }); } };
    };
    const a = setup(() => false, () => Promise.resolve()); a.fire(); await wait(5);
    ok('closing with nothing being saved: the program closes at once (it is not held back), and the network is closed', a.calls.prevented === 0 && a.calls.quit === 0 && a.calls.closed === 1);
    let release; const b = setup(() => true, () => new Promise(r => { release = r; })); b.fire(); await wait(5);
    ok('closing while a save is on its way: the closing is held back, and a wait of at most three seconds is set', b.calls.prevented === 1 && b.calls.quit === 0 && b.timers.length === 1 && b.timers[0].ms === 3000);
    release(); await wait(5);
    ok('...when the save is done the program closes (without waiting for the three seconds)', b.calls.quit === 1);
    b.fire(); await wait(5);
    ok('...and closing again (the program asks again as it closes) is not held back a second time', b.calls.prevented === 1 && b.calls.quit === 1);
    const c = setup(() => true, () => new Promise(() => {})); c.fire(); await wait(5);
    ok('a save that never finishes holds the closing back for three seconds only', c.calls.quit === 0 && (c.timers[0].f(), await wait(5), c.calls.quit === 1));
    const d = setup(() => true, () => Promise.reject(new Error('disk'))); d.fire(); await wait(5);
    ok('a wait that fails still lets the program close', d.calls.prevented === 1 && d.calls.quit === 1);
    let pluginsStopped; const e = setup(() => false, () => Promise.resolve(), {shutdown:()=>new Promise(r=>{pluginsStopped=r;})}); e.fire(); await wait(5);
    ok('plugin shutdown is awaited even with no pending database writes', e.calls.prevented === 1 && e.calls.quit === 0);
    e.fire(); await wait(5); ok('a second close request cannot bypass plugin shutdown', e.calls.prevented === 2 && e.calls.quit === 0);
    pluginsStopped(); await wait(5); ok('clean plugin shutdown permits closing', e.calls.quit === 1); }


  console.log(fails ? fails + ' RESUME-ASYNC TESTS FAILED' : 'ALL RESUME-ASYNC TESTS PASSED'); process.exit(fails ? 1 : 0);
})();
