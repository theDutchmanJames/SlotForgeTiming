// Live timing canvas. The returned node array also owns update/resize/dispose.
// Existing callers can keep using paint(nodes); all presentation uses WidgetView.
const LiveCanvas = (() => {
  const mounted=new WeakMap();
  const clock=()=>typeof performance!=='undefined'?performance.now():Date.now();
  const view=()=>typeof WidgetView!=='undefined'?WidgetView:require('./widgetview.js');
  function fail(n,error) {
    if(n.disposed)return;
    const message=String(error?.message||error);
    if(n.error!==message)console.error('A widget could not be drawn ('+n.w?.type+'):',error);
    n.error=message;n.retryAt=clock()+1000;
    n.el.classList?.add('widget-error');
    if(n.el.setAttribute)n.el.setAttribute('data-widget-error','Widget unavailable — retrying');
  }
  function protect(n,fn) {
    if(n.disposed||(n.error&&clock()<n.retryAt))return;
    try {fn();n.error=null;n.retryAt=0;n.el.classList?.remove('widget-error');n.el.removeAttribute?.('data-widget-error');}
    catch(error){fail(n,error);}
  }
  function fitValue(n,out=n?.out||{},tm) {
    view().fit(n,out,{refit:()=>schedule(n),note:tm?.note?r=>tm.note(n.w.type,r):undefined});
  }
  function schedule(n) {
    if(n.disposed||n.raf!=null||typeof requestAnimationFrame==='undefined')return;
    n.raf=requestAnimationFrame(()=>{n.raf=null;if(!n.disposed&&n.el.isConnected)protect(n,()=>{
      fitValue(n);
      if(view().kind(n.w)==='delta'&&typeof PerfUI!=='undefined')PerfUI.deltaNote?.(n.w.type,{why:'resize'});
    });});
  }
  function dispose(nodes) {
    if(!nodes||nodes.disposed)return;
    nodes.disposed=true;
    for(const n of nodes){n.disposed=true;n.observer?.disconnect();if(n.raf!=null&&typeof cancelAnimationFrame!=='undefined')cancelAnimationFrame(n.raf);n.raf=null;}
  }
  function build(canvas,layout,lanes,o={}) {
    dispose(mounted.get(canvas));
    const nodes=[];mounted.set(canvas,nodes);canvas.innerHTML='';
    canvas.style.aspectRatio=`${layout.ratioW} / ${layout.ratioH}`;
    canvas.style.width=`min(100%, calc((100vh - ${o.maxH??190}px) * ${layout.ratioW/layout.ratioH}))`;
    const back=Backdrop.node(layout);if(back)canvas.appendChild(back);
    for(const w of layout.widgets){
      const d=Widgets.def(w.type);if(!d||(d.perLane&&w.lane>=lanes)||(d.button&&!o.onButton))continue;
      const n=view().mount(canvas,w,layout,o);nodes.push(n);
      // One observer per frame, shared by every adapter; callbacks never size
      // synchronously inside ResizeObserver delivery.
      if(typeof ResizeObserver!=='undefined'){n.observer=new ResizeObserver(()=>schedule(n));n.observer.observe(n.el);}
    }
    Object.defineProperties(nodes,{
      update:{value:(S,tm)=>paint(nodes,S,tm)},
      resize:{value:()=>nodes.forEach(n=>schedule(n))},
      dispose:{value:()=>dispose(nodes)}
    });
    if(o.imageSets&&Widgets.prepareLights)Widgets.prepareLights(layout,o.imageSets);
    return nodes;
  }
  function drawNode(n,S,tm) {
    const t0=tm?tm.now():0,L=n.last;
    const inputKey=Timing.contentKey?.(n.w,S);
    const out=inputKey!=null&&inputKey===n.inputKey&&n.out?n.out:Timing.content(n.w.type==='racechart'?{...n.w,chartSize:{width:n.val.clientWidth,height:n.val.clientHeight}}:n.w,S);
    const themeKey=Frame.themeKey?.()||'';
    const contentChanged=!L||L[0]!==out.html;
    const appearanceChanged=!L||L[1]!==out.color||L[2]!==out.bg||n.themeKey!==themeKey;
    const disabledChanged=!L||L[3]!==out.disabled;
    if(out.chartTrack&&typeof ChartWidgets!=='undefined')ChartWidgets.updateTrack(n,out,S);
    if(!contentChanged)view().updateComponents?.(n,out);
    if(!contentChanged&&!appearanceChanged&&!disabledChanged&&!n.error){if(tm)tm.add(n.w.type,tm.now()-t0,0,0);return;}
    const t1=tm?tm.now():0;
    if(contentChanged){n.val.innerHTML=out.html;if(out.chartTrack&&typeof ChartWidgets!=='undefined'){n.chartTrackFrame=null;ChartWidgets.updateTrack(n,out,S);}}
    if(out.button)n.val.disabled=!!out.disabled;
    if(appearanceChanged||n.error){
      n.el.style.color=out.color||n.base.color||'var(--ink)';
      Object.assign(n.el.style,Frame.style(out.bg||n.base.bg,n.w,'var(--line)',n.layout,Widgets.U));
      n.el.style.setProperty?.('--wf',String(Frame.solidity(n.w,n.layout)));
    }
    const t2=tm?tm.now():0;
    // Colours/control state do not rebuild SVG, images or compound child nodes.
    if(contentChanged||appearanceChanged||n.error)fitValue(n,out,tm);
    // Only a fully successful update becomes the unchanged-output baseline.
    n.last=[out.html,out.color,out.bg,out.disabled];n.out=out;n.inputKey=inputKey;n.themeKey=themeKey;
    if(tm)tm.add(n.w.type,t1-t0,t2-t1,tm.now()-t2);
  }
  function paint(nodes,S,tm) {
    if(!nodes||nodes.disposed)return;
    const frame=Timing.beginFrame?Timing.beginFrame(S):S;
    nodes.forEach(n=>protect(n,()=>drawNode(n,frame,tm)));
  }
  // The fullscreen view: only the widgets of the layout, as large as the window allows, without the buttons (the race is run with the keys).
  // A small bar with a way out appears when the pointer moves (or the screen is touched) and goes away again after a moment. Esc closes the view.
  // o.onClose runs once, when the view is closed (by the button, Esc or close()). Returns { nodes, root, close }: paint the nodes like those of build().
  function fullView(layout, lanes, o = {}) {
    const root = document.createElement('div'), canvas = document.createElement('div'), bar = document.createElement('div'), exit = document.createElement('button');
    root.className = 'fullview'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Timing page, full screen');
    canvas.className = 'canvas live'; bar.className = 'fv-bar'; exit.className = 'btn'; exit.type = 'button'; exit.textContent = 'Exit full screen';
    bar.appendChild(exit); root.appendChild(canvas); root.appendChild(bar); document.body.appendChild(root);
    const nodes = build(canvas, Widgets.withoutControls(layout, lanes).layout, lanes, { maxH: 0 });
    let timer = null, closed = false;
    const show = () => { root.classList.add('show'); clearTimeout(timer); timer = setTimeout(() => root.classList.remove('show'), 2500); };
    const onKey = ev => { if (ev.key === 'Escape') close(); };
    function close() {
      if (closed) return; closed = true;
      dispose(nodes); clearTimeout(timer); document.removeEventListener('keydown', onKey); if (root.parentNode) root.parentNode.removeChild(root);
      if (o.onClose) o.onClose();
    }
    root.onpointermove = show; root.onpointerdown = show; exit.onclick = close;
    document.addEventListener('keydown', onKey); show();
    return { nodes, root, close };
  }
  return { build, paint, fullView, fitValue, dispose };
})();
if (typeof module !== 'undefined') module.exports = LiveCanvas;
