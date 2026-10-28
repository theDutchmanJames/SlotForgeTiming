// Presentation-only shell for App Settings. Move existing controls rather than
// recreate them, so IDs, direct handlers, delegated events and file inputs survive.
const AppSettingsPage = (() => {
  const views = new Map();
  const pages = {
    general: { title:'General', icon:'settings', pills:['Display & units','Home appearance','Performance'], description:'Set how this app looks and reads, personalise Home, and choose how pictures and performance are handled.', help:'These settings apply to this app. Race screen layouts keep their own widget sizes.', sections:[['display','Display','Size, depth and units','custom'],['names','Name and welcome','Personalise this app','drivers'],['header','Header picture','Home banner and framing','image'],['logo','Club logo','Position and size','image'],['pictures','Pictures','Upload quality','image'],['performance','Performance','Rendering and diagnostics','timing'],['data','Database file','Where your data is saved','database']] },
    theme: { title:'App Theme', icon:'custom', pills:['8 ready-made themes','Custom colours','Live preview'], description:'Choose a ready-made theme or adjust your own colours. Changes appear immediately in the app and on connected Live Race pages.', help:'Start from a theme you like, then adjust its colours. Readability warnings help you keep text clear.', sections:[['themes','Choose a theme','Ready-made and Custom','custom'],['colours','Your own colours','Palette and readability','image']] },
    director: { title:'Race Director', icon:'rules', pills:['Lane cards or folders','Adjustment values','Live preview'], description:'Choose the Race Director view, the amounts used by adjustment buttons, and how those buttons are arranged.', help:'Adjustment values are shared with race review. The pad preview is for looking only; it cannot change a race.', sections:[['view','Director view','Lane cards or folders','drivers'],['values','Adjustment values','Points, time and laps','settings'],['layout','Pad layout','Horizontal or vertical','custom'],['preview','Preview','See your adjustment pads','timing']] },
    network: { title:'Network', icon:'live', pills:['Local network','Read-only spectators','Protected Race Director'], description:'Let devices on your local network watch the race. Remote race control is only available when you set a Race Director password.', help:'Use the same local network on each device. The connection folder shows addresses and QR codes while sharing is on.', sections:[['sharing','Share the race','Enable sharing and choose a port','live'],['access','Director access','Password for remote controls','rules'],['devices','Connect devices','Addresses and QR codes','timing']] },
    transfer: { title:'Import and Export', icon:'database', pills:['Share selected items','Import copies','Complete backups'], description:'Export selected items to share them, import items as copies, or save a complete backup. Restoring a backup replaces the current database.', help:'Imports add copies. A complete restore replaces your data and asks for confirmation; the existing safety backup remains part of that process.', first:'export', sections:[['backup','Complete backup','Everything in one file','database'],['export','Export','Choose items to share','custom'],['import','Import','Add items from a file','database']] }
  };
  const icon = name => Icons.svg(Icons.has(name) ? name : 'settings', {size:18});
  function enhance(box, key) {
    // Older headless screen tests use plain objects; only real DOM is decorated.
    if (!box || box.nodeType !== 1 || !pages[key]) return;
    const config=pages[key], first=config.first||config.sections[0][0];
    if(!views.has(key))views.set(key,{active:first,open:{}});
    const v=views.get(key), nodes=[];
    for(const [id,title,note,ico]of config.sections){
      const source=box.querySelector(`:scope > [data-folder="${key}:${id}"],:scope > [data-settings-group="${id}"]`);
      if(!source)continue;
      let section=source, summary, content;
      if(source.tagName==='DETAILS'){
        summary=source.querySelector(':scope > summary');content=source.querySelector(':scope > .fbody');
      }else{
        section=document.createElement('details');source.replaceWith(section);
        summary=document.createElement('summary');content=document.createElement('div');
        source.querySelector(':scope > h3')?.remove();
        content.append(...source.childNodes);section.append(summary,content);
      }
      const caption=summary.querySelector('span')?.textContent||note;
      summary.innerHTML=`<i aria-hidden="true">${icon(ico)}</i><strong>${esc(title)}</strong><span>${esc(caption)}</span><b aria-hidden="true">⌄</b>`;
      section.classList.add('tm-section');section.id=`settings-${key}-${id}-section`;section.dataset.settingsSection=id;
      content.classList.add('tm-content');
      section.open=v.open[id] ?? (id===first);
      nodes.push({id,title,note:caption,icon:icon(ico),section});
    }
    if(!nodes.length)return;
    const reveal=key==='transfer'?(trState.pending?'import':trState.bk?'backup':null):null;
    if(reveal){v.active=reveal;v.open[reveal]=true;nodes.find(n=>n.id===reveal).section.open=true;}
    // Remaining nodes include General/Transfer's existing Open all / Close all.
    const extras=[...box.childNodes].filter(n=>!nodes.some(s=>s.section===n));
    nodes.forEach(n=>n.section.remove());
    const shell=document.createElement('div');
    shell.innerHTML=HardwarePage.html({key:'settings-'+key,title:config.title,icon:icon(config.icon),eyebrow:'App Settings',pills:config.pills,status:key==='transfer'?'Choose a file action':'Changes save automatically',railTitle:'On this page',helpTitle:key==='transfer'?'Choose the right action':'Good to know',help:config.help,description:esc(config.description),sections:nodes.map(n=>({...n,body:'',open:n.section.open}))});
    const root=shell.firstElementChild;root.classList.add('settings-page');root.dataset.settingsPage=key;
    const main=root.querySelector('.tm-main');
    root.querySelector('.tm-say').after(...extras);
    nodes.forEach(n=>root.querySelector(`[data-interface-section="${n.id}"]`).replaceWith(n.section));
    box.replaceChildren(root);
    const buttons=[...root.querySelectorAll('[data-interface-go]')];
    const highlight=id=>{v.active=id;buttons.forEach(b=>{const on=b.dataset.interfaceGo===id;b.classList.toggle('active',on);if(on)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current');});};
    const remember=n=>{
      v.open[n.id]=n.section.open;
      // Keep legacy folder tools and preview/performance toggle handlers working.
      if(n.section.dataset.folder){if(n.section.open)folderClosed.delete(n.section.dataset.folder);else folderClosed.add(n.section.dataset.folder);}
    };
    nodes.forEach(n=>{
      remember(n);
      n.section.addEventListener('toggle',()=>{if(!n.section.isConnected)return;remember(n);if(!n.section.open&&v.active===n.id)highlight(nodes.find(x=>x.section.open)?.id||'');});
      n.section.querySelector('summary').addEventListener('click',()=>{v.open[n.id]=!n.section.open;if(!n.section.open)highlight(n.id);});
    });
    buttons.forEach(b=>b.onclick=()=>{const n=nodes.find(n=>n.id===b.dataset.interfaceGo);n.section.open=true;remember(n);highlight(n.id);n.section.scrollIntoView({block:'start'});n.section.querySelector('summary').focus({preventScroll:true});});
    // Existing bulk-folder handlers redraw the page, so record intent beforehand.
    root.addEventListener('click',e=>{const b=e.target.closest('[data-folderall]');if(!b)return;const open=b.dataset.folderall==='1';nodes.forEach(n=>{v.open[n.id]=open;});highlight(open?first:'');},true);
    highlight(nodes.some(n=>n.id===v.active&&n.section.open)?v.active:nodes.find(n=>n.section.open)?.id||'');
    // Preserve horizontal preview at small widths without stretching the page.
    const preview=main.querySelector('#pad-preview');if(preview)preview.classList.add('settings-pad-preview');
  }
  return {enhance};
})();
