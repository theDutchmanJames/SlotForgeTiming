'use strict';
// Runs the test suite (tests/suite.cjs) in parallel child processes and prints one summary.
//   node tools/run-tests.cjs                 every test, in parallel
//   node tools/run-tests.cjs paddock sqlite  only test files whose name contains one of these words
//   options: -j N (at most N at once; default: processor count - 1, at most 8), --serial (one at a time),
//            --list (print the files and stop), --verbose (print the output of passing tests too)
// A test that fails is run once more on its own: one that passes the second time is reported as unstable, not as passed.
// Tests in SERIAL (they use fixed ports, files or a lot of processor time) run alone, after the parallel ones.
const { spawn } = require('node:child_process'),
  os = require('node:os'),
  path = require('node:path');
const root = path.resolve(__dirname, '..'),
  suite = require(path.join(root, 'tests', 'suite.cjs'));
const SERIAL = new Set([
  'parallelaudit.test.js',
  'parallel.test.js',
  'parallelbackend.test.js',
  'parallelclient.test.js',
  'parallelrace.test.js',
  'carfailuresscreen.test.js',
  'resumeasync.test.js'
]); // (these two measure real time: on a busy processor they miss their window)
const TIMEOUT_MS = 10 * 60 * 1000;
// How long each file took last time (in the ignored .tmp-test folder): the slowest start first, so the run takes about as long as its longest file.
const fs = require('node:fs'),
  TIMES = path.join(root, '.tmp-test', 'test-times.json');
const readTimes = () => {
  try {
    return JSON.parse(fs.readFileSync(TIMES, 'utf8'));
  } catch {
    return {};
  }
};
// the failing checks (wherever they are in the output), then the last lines
const tail = (text, n) => {
  const lines = text.split(/\r?\n/),
    bad = lines.filter(l => /^\s*(FAIL\b|not ok\b|✖)/.test(l)).slice(0, 30);
  return (bad.length ? 'Failing checks:\n' + bad.join('\n') + '\n--- last lines ---\n' : '') + lines.slice(-n).join('\n');
};

const args = process.argv.slice(2),
  opt = { jobs: Math.max(1, Math.min(8, os.cpus().length - 1)), words: [], list: false, verbose: false };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '-j' || a === '--jobs') opt.jobs = Math.max(1, Number(args[++i]) || 1);
  else if (a === '--serial') opt.jobs = 1;
  else if (a === '--list') opt.list = true;
  else if (a === '--verbose') opt.verbose = true;
  else opt.words.push(a.toLowerCase());
}
const chosen = suite.filter(([file]) => !opt.words.length || opt.words.some(w => file.toLowerCase().includes(w)));
if (opt.list) {
  chosen.forEach(([f, m]) => console.log(m.padEnd(10), f));
  console.log(`${chosen.length} test files`);
  process.exit(0);
}
if (!chosen.length) {
  console.error('No test file matches: ' + opt.words.join(', '));
  process.exit(1);
}

function run([file, mode]) {
  return new Promise(resolve => {
    const started = Date.now(),
      argv = [...(mode === 'node-test' ? ['--test', '--test-reporter=spec'] : []), path.join('tests', file)];
    const child = spawn(process.execPath, argv, { cwd: root, env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' }, windowsHide: true });
    let out = '';
    const take = d => {
      out += d;
      if (out.length > 4e6) out = out.slice(-2e6);
    };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    const timer = setTimeout(() => {
      out += `\n[run-tests] stopped after ${TIMEOUT_MS / 60000} minutes`;
      child.kill();
    }, TIMEOUT_MS);
    child.on('close', code => {
      clearTimeout(timer);
      resolve({ file, mode, code, out, ms: Date.now() - started });
    });
    child.on('error', error => {
      clearTimeout(timer);
      resolve({ file, mode, code: -1, out: String(error), ms: Date.now() - started });
    });
  });
}
async function pool(items, jobs, onDone) {
  const results = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(jobs, items.length) }, async () => {
      while (next < items.length) {
        const item = items[next++];
        const r = await run(item);
        results.push(r);
        onDone(r);
      }
    })
  );
  return results;
}
(async () => {
  const t0 = Date.now(),
    times = readTimes(),
    parallel = chosen.filter(([f]) => !SERIAL.has(f)).sort((a, b) => (times[b[0]] || 0) - (times[a[0]] || 0)),
    serial = chosen.filter(([f]) => SERIAL.has(f));
  let done = 0;
  const total = chosen.length;
  const tick = r => {
    done++;
    const mark = r.code === 0 ? 'ok  ' : 'FAIL';
    process.stdout.write(`${mark} ${String(done).padStart(3)}/${total} ${r.file} (${(r.ms / 1000).toFixed(1)} s)\n`);
    if (opt.verbose && r.code === 0) process.stdout.write(r.out + '\n');
  };
  console.log(`Running ${total} test files, ${opt.jobs} at a time${serial.length ? ` (${serial.length} alone at the end)` : ''}.`);
  const results = [...(await pool(parallel, opt.jobs, tick)), ...(await pool(serial, 1, tick))];
  try {
    const all = readTimes();
    results.forEach(r => {
      all[r.file] = r.ms;
    });
    fs.mkdirSync(path.dirname(TIMES), { recursive: true });
    fs.writeFileSync(TIMES, JSON.stringify(all));
  } catch {
    /* only an optimisation */
  }
  const failed = results.filter(r => r.code !== 0),
    unstable = [],
    broken = [];
  for (const r of failed) {
    // once more, alone: separates a real failure from one caused by running next to the others
    const again = await run([r.file, r.mode]);
    (again.code === 0 ? unstable : broken).push(again.code === 0 ? r : again);
  }
  for (const r of unstable)
    console.log(`\n===== UNSTABLE: ${r.file} (failed beside other tests with exit ${r.code}, passed alone) =====\n${tail(r.out, 40)}`);
  for (const r of broken) console.log(`\n===== FAILED: ${r.file} (exit ${r.code}) =====\n${tail(r.out, 60)}`);
  console.log(
    `\n${results.length - failed.length} passed, ${unstable.length} unstable (failed beside other tests, passed alone), ${broken.length} failed · ${((Date.now() - t0) / 1000).toFixed(0)} s`
  );
  if (unstable.length) console.log('Unstable: ' + unstable.map(r => r.file).join(', '));
  if (broken.length) console.log('Failed: ' + broken.map(r => r.file).join(', '));
  process.exit(broken.length ? 1 : 0);
})();
