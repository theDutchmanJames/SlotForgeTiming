// Cuts the statements of one big function into named functions, in place: a group of consecutive statements becomes
// `async function name() { ...statements... }` (or a plain function), declared just before the anchor text, and the group is replaced by a call.
// Locals that more than one group uses are hoisted (const/let x = ... -> x = ..., with `let x;` before the new functions).
// Refuses: a group with a top-level return/break/continue (it would change the flow), a group that is not whole statements, a hoisted name that exists already.
// Usage: node split-fn.cjs <spec.json>   spec: { file, fn, anchor (text where the new functions go, before it), async, groups: [[fromLine, toLine, name, comment]], hoist: [names] }
const fs = require('fs'),
  path = require('path');
const repo = process.cwd();
const espree = require(path.join(repo, 'node_modules', 'espree'));
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const src = fs.readFileSync(spec.file, 'utf8');
const ast = espree.parse(src, { ecmaVersion: 'latest', sourceType: 'script', range: true, loc: true });
let fn = null;
(function walk(n) {
  if (!n || fn || typeof n.type !== 'string') return;
  if (
    (n.type === 'FunctionDeclaration' && n.id && n.id.name === spec.fn) ||
    (n.type === 'VariableDeclarator' &&
      n.id.name === spec.fn &&
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
    else if (v && typeof v === 'object') walk(v);
  }
})(ast);
if (!fn) throw Error('function not found');
const tryBlock = fn.body.body.find(x => x.type === 'TryStatement' && x.block.body.length > 20);
const stmts = spec.inTry && tryBlock ? tryBlock.block.body : fn.body.body;
// top-level flow statements inside a statement (not inside nested functions)
function flow(n, inLoop) {
  if (!n || typeof n.type !== 'string') return false;
  if (/Function/.test(n.type) || n.type === 'ClassBody') return false;
  if (n.type === 'ReturnStatement') return true;
  if ((n.type === 'BreakStatement' || n.type === 'ContinueStatement') && !inLoop && !n.label) return true;
  const loop = inLoop || /Loop|ForStatement|ForIn|ForOf|While|Switch/.test(n.type);
  return Object.keys(n).some(k => {
    const v = n[k];
    return Array.isArray(v) ? v.some(x => flow(x, loop)) : v && typeof v === 'object' && v.type ? flow(v, loop) : false;
  });
}
// an await of the statement itself (not inside a nested function)
function awaits(n) {
  if (!n || typeof n.type !== 'string') return false;
  if (/Function/.test(n.type)) return false;
  if (n.type === 'AwaitExpression' || (n.type === 'ForOfStatement' && n.await)) return true;
  return Object.keys(n).some(k => {
    const v = n[k];
    return Array.isArray(v) ? v.some(awaits) : v && typeof v === 'object' && v.type ? awaits(v) : false;
  });
}
// the comment lines right above a statement belong to it
function leading(start) {
  let a = start;
  for (;;) {
    const prevEnd = a - 1; // (the newline that ends the line above)
    if (prevEnd < 0 || src[prevEnd] !== '\n') return a;
    const prevStart = src.lastIndexOf('\n', prevEnd - 1) + 1;
    const line = src.slice(prevStart, prevEnd);
    if (/^\s*\/\//.test(line)) a = prevStart;
    else return a;
  }
}
const edits = [];
let defs = '';
for (const [from, to, name, comment] of spec.groups) {
  const part = stmts.filter(s => s.loc.start.line >= from && s.loc.start.line <= to);
  if (!part.length) throw Error(`group ${name}: no statements in ${from}-${to}`);
  const last = part[part.length - 1];
  if (last.loc.end.line > to) throw Error(`group ${name}: statement at ${last.loc.start.line} ends at ${last.loc.end.line}, after ${to}`);
  const i0 = stmts.indexOf(part[0]);
  if (stmts.slice(i0, i0 + part.length).some((s, i) => s !== part[i])) throw Error(`group ${name}: not consecutive`);
  for (const s of part) if (flow(s, false)) throw Error(`group ${name}: the statement at line ${s.loc.start.line} returns or breaks`);
  const lineOf = src.lastIndexOf('\n', part[0].range[0] - 1) + 1,
    begin = /^\s*$/.test(src.slice(lineOf, part[0].range[0])) ? leading(lineOf) : part[0].range[0]; // (a statement that starts its line takes the comments above it along)
  let text = src.slice(begin, last.range[1]);
  for (const h of spec.hoist || []) text = text.replace(new RegExp(`(^|\\n)(\\s*)(?:const|let) ${h} = `), `$1$2${h} = `);
  const usesAwait = part.some(awaits);
  defs += `${comment ? '// ' + comment + '\n' : ''}${spec.async || usesAwait ? 'async ' : ''}function ${name}() {\n${text}\n}\n`;
  edits.push([begin, last.range[1], `${spec.async || usesAwait ? 'await ' : ''}${name}();`]);
}
// hoisted names must be new at the top level
for (const h of spec.hoist || [])
  if (new RegExp(`^(?:let|const|var|function|async function) ${h}\\b`, 'm').test(src)) throw Error('name exists at the top level: ' + h);
let out = src;
for (const [a, b, t] of edits.sort((x, y) => y[0] - x[0])) out = out.slice(0, a) + t + out.slice(b);
const at = out.indexOf(spec.anchor);
if (at < 0 || out.indexOf(spec.anchor, at + 1) >= 0) throw Error('anchor not found once');
const head = (spec.header ? spec.header + '\n' : '') + (spec.hoist && spec.hoist.length ? `let ${spec.hoist.join(', ')};\n` : '');
out = out.slice(0, at) + head + defs + '\n' + out.slice(at);
fs.writeFileSync(spec.file, out);
console.log(`${spec.groups.length} groups moved out of ${spec.fn}`);
