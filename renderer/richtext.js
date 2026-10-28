// The text of the Racing Rules: a little formatting (bold, italic, underline, size, colour, lists, headings) kept as safe HTML.
// clean() is used when the rules are saved and again when they are shown, so only these tags and settings ever get through.
(function (root) {
  const TAGS = { b: 'b', strong: 'b', i: 'i', em: 'i', u: 'u', s: 's', strike: 's', br: 'br', p: 'p', div: 'div', ul: 'ul', ol: 'ol', li: 'li', h1: 'h1', h2: 'h2', h3: 'h3', font: 'font', span: 'span' };
  const VOID = { br: 1 };
  const esc = s => s.replace(/&(?!(amp|lt|gt|nbsp|quot|#\d{1,6});)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const colorOk = c => /^#[0-9a-f]{3,8}$/i.test(c) || /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\)$/i.test(c) || /^[a-z]{3,20}$/i.test(c);
  const attr = (s, name) => { const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(s); return m ? (m[1] ?? m[2] ?? m[3] ?? '') : ''; };
  // a style="" attribute: only colour, size, bold, italic, underline and alignment survive
  function styleOf(style) {
    const out = [];
    style.split(';').forEach(d => {
      const i = d.indexOf(':'); if (i < 0) return;
      const k = d.slice(0, i).trim().toLowerCase(), v = d.slice(i + 1).trim();
      if (k === 'color' && colorOk(v)) out.push(`color:${v}`);
      else if (k === 'font-size' && /^(\d{1,3}(\.\d+)?(px|pt|em|rem|%)|xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large)$/i.test(v)) out.push(`font-size:${v}`);
      else if (k === 'font-weight' && /^(bold|normal|[1-9]00)$/i.test(v)) out.push(`font-weight:${v}`);
      else if (k === 'font-style' && /^(italic|normal)$/i.test(v)) out.push(`font-style:${v}`);
      else if (k === 'text-decoration' && /^(underline|none|line-through)$/i.test(v)) out.push(`text-decoration:${v}`);
      else if (k === 'text-align' && /^(left|center|right)$/i.test(v)) out.push(`text-align:${v}`);
    });
    return out.join(';');
  }
  function clean(html) {
    html = String(html ?? ''); if (!html) return '';
    if (!/<[a-z/!]/i.test(html)) return esc(html).replace(/\r?\n/g, '<br>'); // plain text from before there was formatting
    html = html.replace(/<(script|style|iframe|object|embed|template)\b[\s\S]*?<\/\1\s*>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
    const out = [], stack = [], re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)|</g;
    let m;
    while ((m = re.exec(html))) {
      if (m[4] !== undefined) { out.push(esc(m[4])); continue; }
      if (m[2] === undefined) { out.push('&lt;'); continue; }
      const tag = TAGS[m[2].toLowerCase()]; if (!tag) continue; // anything else is dropped (its text stays)
      if (m[1]) { // a closing tag: close what is open down to it, ignore it when it was never opened
        const at = stack.lastIndexOf(tag); if (at < 0) continue;
        while (stack.length > at) out.push(`</${stack.pop()}>`);
        continue;
      }
      let a = '';
      if (tag === 'font') { const c = attr(m[3], 'color'), z = attr(m[3], 'size'); if (c && colorOk(c)) a += ` color="${c}"`; if (/^[1-7]$/.test(z)) a += ` size="${z}"`; }
      else if (tag === 'span' || tag === 'div' || tag === 'p' || /^h[1-3]$/.test(tag)) { const st = styleOf(attr(m[3], 'style')); if (st) a += ` style="${st}"`; }
      out.push(`<${tag}${a}>`);
      if (!VOID[tag]) stack.push(tag);
    }
    while (stack.length) out.push(`</${stack.pop()}>`);
    return out.join('');
  }
  // the plain text of formatted rules (for an empty check)
  const text = html => String(clean(html)).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  const api = { clean, text };
  root.RichText = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
