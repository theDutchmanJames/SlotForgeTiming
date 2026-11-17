// Moves groups of consecutive statements out of one big function into their own functions, handing over exactly the locals they use:
//   function name({ a, b, c }) { ...statements...; return { x, y }; }      and in place:   const { x, y } = name({ a, b, c });
// Safe only when nothing can tell the difference, so a group is refused when:
//  - it assigns to (or ++/--) a local of the big function that is declared outside the group;
//  - it uses a local that is reassigned anywhere (its value could change after the hand-over);
//  - it uses a const/let declared later in the big function (it would not exist yet at the hand-over);
//  - it has a top-level return/break/continue/yield, or uses this/arguments/new.target at its top level;
//  - a name it declares is used outside and is reassigned anywhere.
// Usage: node extract-fn.cjs <spec.json> [--check]   spec: { file, fn, place: 'before-fn' | 'top' , prefix comment, groups: [[fromLine, toLine, name, comment]] }
// --check: only says, per group, whether it can move and why not.
const fs = require('fs'),
  path = require('path');
const repo = process.cwd();
const espree = require(path.join(repo, 'node_modules', 'espree'));
const eslintScope = require(path.join(repo, 'node_modules', 'eslint-scope'));
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const check = process.argv.includes('--check');
const src = fs.readFileSync(spec.file, 'utf8');
const ast = espree.parse(src, { ecmaVersion: 'latest', sourceType: 'script', range: true, loc: true });
const sm = eslintScope.analyze(ast, { ecmaVersion: 2022, sourceType: 'script' });
let fn = null;
(function walk(n) {
  if (!n || fn || typeof n.type !== 'string') return;
  if (
    (n.type === 'FunctionDeclaration' && n.id && n.id.name === spec.fn) ||
    (n.type === 'VariableDeclarator' && n.id.name === spec.fn && n.init && /Function/.test(n.init.type))
  ) {
    fn = n.type === 'VariableDeclarator' ? n.init : n;
    return;
  }
  for (const k of Object.keys(n)) {
    const v = n[k];
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') walk(v);
  }
})(ast);
if (!fn) throw Error('function not found: ' + spec.fn);
const scope = sm.acquire(fn);
const stmts = fn.body.body;
const vars = scope.variables.filter(v => v.name !== 'arguments');
const inside = (node, [a, b]) => node.range[0] >= a && node.range[1] <= b;
const reassigned = v => v.references.some(r => r.isWrite() && !(r.init && v.defs.some(d => d.name === r.identifier)));
const kindOf = v =>
  v.defs[0]
    ? v.defs[0].type === 'FunctionName'
      ? 'function'
      : v.defs[0].type === 'Parameter'
        ? 'param'
        : v.defs[0].parent?.kind || v.defs[0].type
    : '?';
// looks through a statement, not into nested functions; an arrow function is looked into with inArrow (its this/arguments are the outer ones)
function topLevel(n, test, inLoop = false, inArrow = false) {
  if (!n || typeof n.type !== 'string') return false;
  if (/Function/.test(n.type) && n.type !== 'ArrowFunctionExpression') return false;
  if (n.type === 'ArrowFunctionExpression') return topLevel(n.body, test, false, true);
  if (test(n, inLoop, inArrow)) return true;
  const loop = inLoop || /Loop|ForStatement|ForIn|ForOf|While|Switch/.test(n.type);
  return Object.keys(n).some(k => {
    const v = n[k];
    return Array.isArray(v)
      ? v.some(x => topLevel(x, test, loop, inArrow))
      : v && typeof v === 'object' && v.type
        ? topLevel(v, test, loop, inArrow)
        : false;
  });
}
const bad = (n, inLoop, inArrow) =>
  (!inArrow &&
    (n.type === 'ReturnStatement' ||
      n.type === 'YieldExpression' ||
      ((n.type === 'BreakStatement' || n.type === 'ContinueStatement') && !inLoop && !n.label))) ||
  n.type === 'ThisExpression' ||
  n.type === 'MetaProperty' ||
  (n.type === 'Identifier' && n.name === 'arguments');
const awaits = n => topLevel(n, (x, _l, inArrow) => !inArrow && (x.type === 'AwaitExpression' || (x.type === 'ForOfStatement' && x.await)));
function plan([from, to, name]) {
  const part = stmts.filter(s => s.loc.start.line >= from && s.loc.start.line <= to);
  if (!part.length) return { name, error: `no statements in ${from}-${to}` };
  const last = part[part.length - 1];
  if (last.loc.end.line > to) return { name, error: `the statement at ${last.loc.start.line} ends at ${last.loc.end.line}` };
  const range = [part[0].range[0], last.range[1]];
  const why = [];
  for (const s of part) if (topLevel(s, bad)) why.push(`line ${s.loc.start.line}: return/break/this/arguments at its top level`);
  const uses = new Set(),
    gives = new Set();
  for (const v of vars) {
    const declaredIn = v.defs.some(d => inside(d.name, range));
    const refsIn = v.references.filter(r => inside(r.identifier, range)),
      refsOut = v.references.filter(r => !inside(r.identifier, range));
    if (declaredIn) {
      if (refsOut.length || (v.defs[0].type === 'FunctionName' && v.references.some(r => !inside(r.identifier, range)))) {
        gives.add(v.name);
        if (reassigned(v) && v.references.some(r => r.isWrite() && !inside(r.identifier, range)))
          why.push(`${v.name} (declared here) is reassigned outside`);
        if (reassigned(v) && refsOut.length) why.push(`${v.name} (declared here, used outside) is reassigned`);
        // a function declared in the group and used before it: hoisting would be lost
        if (v.defs[0].type === 'FunctionName' && refsOut.some(r => r.identifier.range[0] < range[0]))
          why.push(`function ${v.name} is used before the group (hoisted)`);
      }
      continue;
    }
    if (!refsIn.length) continue;
    uses.add(v.name);
    if (refsIn.some(r => r.isWrite())) why.push(`writes ${v.name}`);
    else if (reassigned(v)) why.push(`${v.name} is reassigned elsewhere`);
    const k = kindOf(v);
    if ((k === 'const' || k === 'let' || k === 'Variable') && v.defs[0].name.range[0] > range[0])
      why.push(`${v.name} is declared after the group`);
    if (k === 'function' && v.defs[0].name.range[0] > range[0]) {
      /* (a function declaration is hoisted: it exists at the hand-over) */
    }
  }
  return { name, part, range, uses: [...uses].sort(), gives: [...gives].sort(), async: part.some(awaits), error: why.join('; ') };
}
if (process.argv.includes('--auto')) {
  // the largest groups of consecutive statements that can move, at least minLines long
  const min = Number(spec.minLines || 30),
    found = [];
  let i = 0;
  while (i < stmts.length) {
    let best = null;
    for (let j = i; j < stmts.length; j++) {
      const p = plan([stmts[i].loc.start.line, stmts[j].loc.end.line, 'g' + i]);
      if (!p.error && p.part && p.part.length === j - i + 1) best = { j, p };
      if (stmts[j].loc.end.line - stmts[i].loc.start.line > 900) break;
    }
    if (best && stmts[best.j].loc.end.line - stmts[i].loc.start.line + 1 >= min) {
      found.push([stmts[i].loc.start.line, stmts[best.j].loc.end.line, best.p.uses.length, best.p.gives.join(',')]);
      i = best.j + 1;
    } else i++;
  }
  let total = 0;
  for (const [a, b, u, g] of found) {
    total += b - a + 1;
    console.log(a + '-' + b, '(' + (b - a + 1) + ' lines) uses ' + u + ' gives ' + g);
  }
  console.log('movable lines:', total, 'of', fn.loc.end.line - fn.loc.start.line);
  process.exit(0);
}
const plans = spec.groups.map(g => ({ ...plan(g), comment: g[3] }));
if (check) {
  for (const p of plans)
    console.log(
      (p.error ? 'NO  ' : 'ok  ') +
        p.name +
        (p.part
          ? ` (${p.part[0].loc.start.line}-${p.part[p.part.length - 1].loc.end.line}, ${p.range && p.part[p.part.length - 1].loc.end.line - p.part[0].loc.start.line + 1} lines) uses ${p.uses.length}: ${p.uses.join(',')} gives: ${p.gives.join(',')}`
          : '') +
        (p.error ? '\n      ' + p.error : '')
    );
  process.exit(0);
}
const failed = plans.filter(p => p.error);
if (failed.length) throw Error(failed.map(p => p.name + ': ' + p.error).join('\n'));
// overlapping groups are not allowed
plans
  .sort((a, b) => a.range[0] - b.range[0])
  .forEach((p, i, a) => {
    if (i && a[i - 1].range[1] > p.range[0]) throw Error('groups overlap: ' + a[i - 1].name + ' / ' + p.name);
  });
let out = src,
  defs = '';
for (const p of [...plans].sort((a, b) => b.range[0] - a.range[0])) {
  // comment lines right above the group go with it
  let begin = p.range[0];
  const lineOf = src.lastIndexOf('\n', begin - 1) + 1;
  if (/^\s*$/.test(src.slice(lineOf, begin))) {
    begin = lineOf;
    for (;;) {
      const prevEnd = begin - 1;
      if (prevEnd < 0 || src[prevEnd] !== '\n') break;
      const prevStart = src.lastIndexOf('\n', prevEnd - 1) + 1;
      if (/^\s*\/\//.test(src.slice(prevStart, prevEnd))) begin = prevStart;
      else break;
    }
  }
  const text = src.slice(begin, p.range[1]);
  const args = p.uses.length ? `{ ${p.uses.join(', ')} }` : '';
  const call = `${p.async ? 'await ' : ''}${p.name}(${p.uses.length ? `{ ${p.uses.join(', ')} }` : ''})`;
  const replaced = p.gives.length ? `const { ${p.gives.join(', ')} } = ${call};` : `${call};`;
  out = out.slice(0, begin) + replaced + out.slice(p.range[1]);
  defs =
    `${p.comment ? '// ' + p.comment + '\n' : ''}${p.async ? 'async ' : ''}function ${p.name}(${args}) {\n${text}\n${p.gives.length ? `return { ${p.gives.join(', ')} };\n` : ''}}\n` +
    defs;
}
// where the new functions go: right before the big function (inside the same scope)
const host = fn.type === 'FunctionDeclaration' ? fn : null;
let at;
if (spec.anchor) at = out.indexOf(spec.anchor);
else if (host) at = out.lastIndexOf('\n', out.indexOf(src.slice(host.range[0], host.range[0] + 60))) + 1;
if (at === undefined || at < 0) throw Error('no place for the new functions');
out = out.slice(0, at) + (spec.header ? spec.header + '\n' : '') + defs + '\n' + out.slice(at);
fs.writeFileSync(spec.file, out);
console.log(plans.length + ' groups moved out of ' + spec.fn + ': ' + plans.map(p => p.name).join(', '));
