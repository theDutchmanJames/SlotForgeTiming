// The coloured folders (1.15.0): the collapsible folders of the Race Director page (1.11.1), made once for the Director page and the Race tab, so the two look and work the same.
// A folder has a title, a short note, a colour (tone: yellow, white, red, blue, brown, green, teal, purple or plain) and a body. A folder you close stays closed while the app is open (on both pages).
const DirFolder = (() => {
  const shut = new Set(); // the ids of the folders that were closed
  // id: the folder; title and note: the text of the summary (made by the page: not escaped here); tone: the colour; inner: the html of the body; o.id: an id for the <details>, to find it
  const html = (id, title, note, tone, inner, o) => `<details class="dbfolder dirfolder${tone ? ' dir-' + tone : ''}" data-dirf="${id}"${o && o.id ? ` id="${o.id}"` : ''}${shut.has(id) ? '' : ' open'}><summary><strong>${title}</strong> <span class="muted">${note}</span></summary><div class="df-body">${inner}</div></details>`;
  // watch the folders in a page (root): opening and closing is remembered
  const bind = root => { if (root && root.querySelectorAll) root.querySelectorAll('details.dirfolder').forEach(el => { el.ontoggle = () => { if (el.open) shut.delete(el.dataset.dirf); else shut.add(el.dataset.dirf); }; }); };
  return { html, bind, shut };
})();
