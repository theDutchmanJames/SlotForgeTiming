// Geometry uses percentages of a parent canvas; editing never changes race data.
(function(root){
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const number=(v,d)=>v!==''&&v!=null&&Number.isFinite(Number(v))?Number(v):d;
  const round=v=>Math.round(v*10000)/10000;
  function rect(raw={}){raw=raw&&typeof raw==='object'?raw:{};const w=clamp(number(raw.w,45),1,100),h=clamp(number(raw.h,25),1,100);return {x:round(clamp(number(raw.x,5),0,100-w)),y:round(clamp(number(raw.y,5),0,100-h)),w:round(w),h:round(h)};}
  function bounds(nodes){const a=nodes.map(n=>rect(n.frame||n)),x=Math.min(...a.map(r=>r.x)),y=Math.min(...a.map(r=>r.y));return {x,y,w:Math.max(...a.map(r=>r.x+r.w))-x,h:Math.max(...a.map(r=>r.y+r.h))-y};}
  function move(frames,dx,dy){const b=bounds(frames);dx=clamp(dx,-b.x,100-b.x-b.w);dy=clamp(dy,-b.y,100-b.y-b.h);return frames.map(r=>({...r,x:round(r.x+dx),y:round(r.y+dy)}));}
  function resize(r,handle,dx,dy,minW=1,minH=1){let l=r.x,t=r.y,right=r.x+r.w,bottom=r.y+r.h;if(handle.includes('w'))l=clamp(l+dx,0,right-minW);if(handle.includes('e'))right=clamp(right+dx,l+minW,100);if(handle.includes('n'))t=clamp(t+dy,0,bottom-minH);if(handle.includes('s'))bottom=clamp(bottom+dy,t+minH,100);return {x:round(l),y:round(t),w:round(right-l),h:round(bottom-t)};}
  function snap(r,others,grid=2,tx=1,ty=1,handle=''){
    const out={...r},guides={};
    for(const [axis,size,tol] of [['x','w',tx],['y','h',ty]]){
      const start=axis==='x'?'w':'n',end=axis==='x'?'e':'s';if(handle&&!handle.includes(start)&&!handle.includes(end))continue;
      const factors=handle?[handle.includes(start)?0:1]:[0,.5,1],targets=[0,50,100,...others.flatMap(o=>[o[axis],o[axis]+o[size]/2,o[axis]+o[size]])];
      let best=null;for(const f of factors)for(const t of targets){const delta=t-(r[axis]+r[size]*f);if(Math.abs(delta)<=tol&&(!best||Math.abs(delta)<Math.abs(best.delta)))best={delta,target:t};}
      const delta=best?.delta??(grid>0?Math.round((r[axis]+(handle&&handle.includes(end)?r[size]:0))/grid)*grid-(r[axis]+(handle&&handle.includes(end)?r[size]:0)):0);
      if(handle){if(handle.includes(start)){out[axis]+=delta;out[size]-=delta;}else out[size]+=delta;}else out[axis]+=delta;
      if(best)guides[axis]=best.target;
    }
    return {frame:rect(out),guides};
  }
  function group(parent,ids,id){const nodes=parent.children.filter(n=>ids.includes(n.id));if(nodes.length<2||nodes.some(n=>n.locked))return null;const b=bounds(nodes),index=Math.max(...nodes.map(n=>parent.children.indexOf(n)));
    const g={id,kind:'free',label:'Group',frame:b,children:nodes.map(n=>({...n,frame:{x:(n.frame.x-b.x)/b.w*100,y:(n.frame.y-b.y)/b.h*100,w:n.frame.w/b.w*100,h:n.frame.h/b.h*100}}))};
    parent.children.splice(index+1,0,g);parent.children=parent.children.filter(n=>!ids.includes(n.id));return g;
  }
  function ungroup(parent,node){if(node.kind!=='free'||node.locked||node.children.some(n=>n.locked))return false;const b=node.frame,k=parent.children.indexOf(node);const kids=node.children.map(n=>({...n,frame:rect({x:b.x+n.frame.x/100*b.w,y:b.y+n.frame.y/100*b.h,w:n.frame.w/100*b.w,h:n.frame.h/100*b.h})}));parent.children.splice(k,1,...kids);return kids;}
  function align(nodes,how){if(!nodes.length||nodes.some(n=>n.locked))return;const b=nodes.length===1?{x:0,y:0,w:100,h:100}:bounds(nodes);for(const n of nodes){const r=n.frame;if(how==='left')r.x=b.x;if(how==='center')r.x=b.x+(b.w-r.w)/2;if(how==='right')r.x=b.x+b.w-r.w;if(how==='top')r.y=b.y;if(how==='middle')r.y=b.y+(b.h-r.h)/2;if(how==='bottom')r.y=b.y+b.h-r.h;n.frame=rect(r);}}
  function selected(doc,ui,C){const hit=C.find(doc,ui.selected);if(!hit?.parent||hit.parent.kind!=='free')return {nodes:[],parent:null};const ids=ui.multi?.includes(ui.selected)?ui.multi:[ui.selected];return {parent:hit.parent,nodes:hit.parent.children.filter(n=>ids.includes(n.id))};}
  function attach(target,doc,ui,C,onChange,onSelect,fit){
    let drag=null,raf=0,pending=null;target.tabIndex=0;target.setAttribute('aria-label','Widget canvas. Drag elements, resize with handles, or use arrow keys.');
    const element=id=>target.querySelector(`[data-wc-id="${id}"]`);
    const layer=document.createElement('div');layer.className='wc-selection-layer';target.appendChild(layer);
    function decorate(guides={},parent=null){layer.innerHTML='';const tr=target.getBoundingClientRect(),{nodes}=selected(doc,ui,C);
      for(const n of nodes){const el=element(n.id);if(!el)continue;const r=el.getBoundingClientRect(),box=document.createElement('div');box.className='wc-selection'+(n.locked?' locked':'');Object.assign(box.style,{left:(r.left-tr.left)+'px',top:(r.top-tr.top)+'px',width:r.width+'px',height:r.height+'px'});
        if(nodes.length===1&&!n.locked)for(const dir of ['nw','n','ne','e','se','s','sw','w']){const handle=document.createElement('span');handle.className='wc-handle wc-handle-'+dir;handle.dataset.wcHandle=dir;handle.dataset.wcOwner=n.id;handle.setAttribute('aria-label','Resize '+dir);box.appendChild(handle);}layer.appendChild(box);
      }
      if(parent){const r=element(parent.id)?.getBoundingClientRect();if(r)for(const [axis,value]of Object.entries(guides)){const guide=document.createElement('div');guide.className='wc-guide '+axis;Object.assign(guide.style,axis==='x'?{left:(r.left-tr.left+r.width*value/100)+'px',top:(r.top-tr.top)+'px',height:r.height+'px'}:{top:(r.top-tr.top+r.height*value/100)+'px',left:(r.left-tr.left)+'px',width:r.width+'px'});layer.appendChild(guide);}}
    }
    function setFrames(frames){drag.nodes.forEach((n,i)=>{n.frame=frames[i];const el=element(n.id);if(el)for(const k of ['x','y','w','h'])el.style.setProperty('--wc-'+k,n.frame[k]+'%');});}
    function apply(){raf=0;if(!drag||!pending)return;const p=pending;pending=null;const dx=(p.x-drag.x)*100/drag.rect.width,dy=(p.y-drag.y)*100/drag.rect.height;let frames,guides={};
      if(drag.handle){let r=resize(drag.frames[0],drag.handle,dx,dy,Math.min(drag.frames[0].w,1600/drag.rect.width),Math.min(drag.frames[0].h,1600/drag.rect.height));if(ui.snap!==false&&!p.alt){const sn=snap(r,drag.others,ui.grid??2,400/drag.rect.width,400/drag.rect.height,drag.handle);r=resize(drag.frames[0],drag.handle,drag.handle.includes('w')?sn.frame.x-drag.frames[0].x:sn.frame.x+sn.frame.w-drag.frames[0].x-drag.frames[0].w,drag.handle.includes('n')?sn.frame.y-drag.frames[0].y:sn.frame.y+sn.frame.h-drag.frames[0].y-drag.frames[0].h,Math.min(drag.frames[0].w,1600/drag.rect.width),Math.min(drag.frames[0].h,1600/drag.rect.height));guides=sn.guides;}frames=[r];}
      else {frames=move(drag.frames,dx,dy);if(ui.snap!==false&&!p.alt){const b=bounds(frames),sn=snap(b,drag.others,ui.grid??2,400/drag.rect.width,400/drag.rect.height);frames=move(frames,sn.frame.x-b.x,sn.frame.y-b.y);guides=sn.guides;}}
      setFrames(frames);if(drag.handle)fit();decorate(guides,drag.parent);
    }
    function end(cancel=false){if(!drag)return;if(raf){cancelAnimationFrame(raf);raf=0;}if(!cancel&&pending)apply();const old=drag;if(cancel)setFrames(old.frames);drag=null;pending=null;ui.dragging=false;try{target.releasePointerCapture(old.pointer);}catch{}const changed=!cancel&&old.nodes.some((n,i)=>JSON.stringify(n.frame)!==JSON.stringify(old.frames[i]));if(changed)onChange();else onSelect();}
    target.onpointerdown=e=>{
      if(e.button!==0||drag)return;const handle=e.target.closest('[data-wc-handle]');let el=handle?element(handle.dataset.wcOwner):e.target.closest('[data-wc-id]');if(!el)return;
      let hit=C.find(doc,el.dataset.wcId),current=C.find(doc,ui.selected);
      if(!handle&&!e.altKey&&current?.node.kind==='free'&&current.parent?.kind==='free'&&C.find({root:current.node},hit?.node.id))hit=current;
      if(hit?.parent?.kind!=='free')return;
      e.preventDefault();e.stopPropagation();target.focus({preventScroll:true});
      const same=selected(doc,ui,C);if((e.shiftKey||e.ctrlKey||e.metaKey)&&!handle){const ids=same.parent===hit.parent?same.nodes.map(n=>n.id):[];ui.multi=ids.includes(hit.node.id)?ids.filter(id=>id!==hit.node.id):[...ids,hit.node.id];ui.selected=ui.multi.at(-1)||hit.parent.id;decorate();onSelect();return;}
      if(!ui.multi?.includes(hit.node.id))ui.multi=[hit.node.id];ui.selected=hit.node.id;const sel=selected(doc,ui,C);decorate();
      if(sel.nodes.some(n=>n.locked)){onSelect();return;}
      const pr=element(hit.parent.id).getBoundingClientRect();if(!pr.width||!pr.height)return;
      drag={nodes:sel.nodes,parent:hit.parent,frames:sel.nodes.map(n=>({...n.frame})),others:hit.parent.children.filter(n=>!sel.nodes.includes(n)).map(n=>n.frame),handle:handle?.dataset.wcHandle||'',x:e.clientX,y:e.clientY,rect:pr,pointer:e.pointerId};ui.dragging=true;target.setPointerCapture(e.pointerId);
    };
    target.onpointermove=e=>{if(!drag||e.pointerId!==drag.pointer)return;pending={x:e.clientX,y:e.clientY,alt:e.altKey};if(!raf)raf=requestAnimationFrame(apply);};
    target.onpointerup=e=>{if(drag&&e.pointerId===drag.pointer){e.preventDefault();e.stopPropagation();end();}};
    target.onpointercancel=()=>end(true);target.onlostpointercapture=()=>{if(drag)end(true);};
    // A completed drag must not bubble a second selection click into the editor.
    target.onclick=e=>{if(e.target.closest('[data-wc-handle]')||e.target.closest('.wc-free > .wc-block'))e.stopPropagation();};
    target.onkeydown=e=>{if(e.target!==target)return;if(e.key==='Escape'&&drag){e.preventDefault();end(true);return;}const {nodes,parent}=selected(doc,ui,C);if(!nodes.length||nodes.some(n=>n.locked)||drag)return;
      const arrows={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(arrows[e.key]){e.preventDefault();const r=element(parent.id).getBoundingClientRect(),step=e.shiftKey?10:1,[x,y]=arrows[e.key],frames=move(nodes.map(n=>n.frame),x*step*100/r.width,y*step*100/r.height);nodes.forEach((n,i)=>n.frame=frames[i]);onChange();}
    };
    decorate();return ()=>{if(raf)cancelAnimationFrame(raf);if(drag){setFrames(drag.frames);drag=null;ui.dragging=false;}target.onpointerdown=target.onpointermove=target.onpointerup=target.onpointercancel=target.onlostpointercapture=target.onkeydown=target.onclick=null;layer.remove();};
  }
  const api={rect,bounds,move,resize,snap,group,ungroup,align,selected,attach};
  if(typeof module!=='undefined')module.exports=api;else root.WidgetFree=api;
})(typeof globalThis!=='undefined'?globalThis:this);
