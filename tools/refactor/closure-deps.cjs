// For a file whose code lives inside one big function: which statements of that function use none of its local names
// (and can move out unchanged), and how the rest depend on each other. Usage: node closure-deps.cjs <file> <functionName>
const fs = require('fs'),
  path = require('path');
const repo = process.cwd();
const espree = require(path.join(repo, 'node_modules', 'espree'));
const eslintScope = require(path.join(repo, 'node_modules', 'eslint-scope'));
const [file, fnName] = process.argv.slice(2);
const src = fs.readFileSync(file, 'utf8');
const ast = espree.parse(src, { ecmaVersion: 'latest', sourceType: 'script', range: true, loc: true });
const sm = eslintScope.analyze(ast, { ecmaVersion: 2022, sourceType: 'script' });
let fn = null;
(function walk(n) {
  if (!n || fn || typeof n.type !== 'string') return;
  if (
    (n.type === 'FunctionDeclaration' && n.id && n.id.name === fnName) ||
    (n.type === 'VariableDeclarator' &&
      n.id.name === fnName &&
      n.init &&
      (/Function/.test(n.init.type) ||
        (n.init.type === 'CallExpression' && n.init.arguments[0] && /Function/.test(n.init.arguments[0].type))))
  ) {
    fn = n.type === 'VariableDeclarator' ? (/Function/.test(n.init.type) ? n.init : n.init.arguments[0]) : n;
    return;
  }
  for (const k of Object.keys(n)) {
    const v = n[k];
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object' && k !== 'parent') walk(v);
  }
})(ast);
const fnScope = sm.acquire(fn);
const innerTry = fn.body.body.find(x => x.type === 'TryStatement' && x.block.body.length > 20);
const blockScope = innerTry ? sm.acquire(innerTry.block) : null;
const scopeVars0 = innerTry ? [...fnScope.variables, ...blockScope.variables] : fnScope.variables;
// which top-level statement of the function declares each local name
const stmts = innerTry ? innerTry.block.body : fn.body.body;

const declIn = new Map();
stmts.forEach((s, i) => {
  for (const v of scopeVars0)
    for (const d of v.defs) if (d.node.range[0] >= s.range[0] && d.node.range[1] <= s.range[1]) declIn.set(v.name, i);
});
// for each statement: the locals it uses that are declared in another statement
const uses = stmts.map(() => new Set());
for (const v of scopeVars0)
  for (const ref of v.references) {
    const at = ref.identifier.range[0],
      i = stmts.findIndex(s => at >= s.range[0] && at < s.range[1]);
    if (i >= 0 && declIn.get(v.name) !== i) uses[i].add(v.name);
  }
let free = 0,
  freeLines = 0;
const rows = [];
stmts.forEach((s, i) => {
  const names = [...scopeVars0].filter(v => declIn.get(v.name) === i).map(v => v.name);
  const lines = s.loc.end.line - s.loc.start.line + 1;
  if (!uses[i].size) {
    free++;
    freeLines += lines;
  }
  rows.push({ i, line: s.loc.start.line, lines, kind: s.type, names: names.slice(0, 4).join(','), deps: uses[i].size });
});
console.log(`${stmts.length} statements in ${fnName}; ${free} use none of its locals (${freeLines} lines)`);
const big = rows.filter(r => r.lines >= 40).sort((a, b) => b.lines - a.lines);
console.log('largest statements (lines, local names used, declares):');
for (const r of big.slice(0, 25))
  console.log(String(r.line).padStart(5), String(r.lines).padStart(5), 'lines', String(r.deps).padStart(3), 'deps', r.kind, r.names);
const byDeps = {};
rows.forEach(r => {
  const b = r.deps === 0 ? '0' : r.deps <= 3 ? '1-3' : r.deps <= 8 ? '4-8' : '9+';
  byDeps[b] = (byDeps[b] || 0) + r.lines;
});
console.log('lines by number of locals used:', JSON.stringify(byDeps));
console.log(
  'lines that use no locals, by statement start:',
  rows
    .filter(r => !r.deps && r.lines > 5)
    .map(r => `${r.line}(${r.lines} ${r.names})`)
    .join(' ')
);
if (process.env.LOCALS) {
  for (const v of scopeVars0) {
    const users = new Set();
    for (const ref of v.references) {
      const at = ref.identifier.range[0],
        i = stmts.findIndex(s => at >= s.range[0] && at < s.range[1]);
      if (i >= 0) users.add(stmts[i].loc.start.line);
    }
    const d = declIn.get(v.name);
    console.log(v.name.padEnd(22), 'declared', d === undefined ? '?' : stmts[d].loc.start.line, 'used at', [...users].join(','));
  }
}
if (process.env.LIST)
  stmts.forEach(s =>
    console.log(
      String(s.loc.start.line).padStart(5),
      String(s.loc.end.line - s.loc.start.line + 1).padStart(4),
      src.slice(s.range[0], s.range[0] + 110).split('\n')[0]
    )
  );
