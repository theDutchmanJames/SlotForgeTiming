// Editor host bookkeeping. WidgetView remains responsible for widget appearance
// and fitting; moving a mounted widget does not change its content or font size.
(function(root){
  'use strict';
  function latest(fn, request=root.requestAnimationFrame?.bind(root), cancel=root.cancelAnimationFrame?.bind(root)){
    let ticket=null, pending=false, value;
    const run=()=>{ticket=null;if(!pending)return;pending=false;const v=value;value=undefined;fn(v);};
    return {
      push(v){value=v;pending=true;if(ticket===null)ticket=request(run);},
      flush(){if(ticket!==null)cancel(ticket);ticket=null;run();},
      cancel(){if(ticket!==null)cancel(ticket);ticket=null;pending=false;value=undefined;}
    };
  }
  const signature=w=>JSON.stringify(Object.fromEntries(Object.entries(w).filter(([k])=>!['x','y','w','h'].includes(k))));
  function create({canvas,layout,html,fit}){
    const records=new Map();let layoutKey;
    const labelGeometry=(r,w)=>{
      if(!r.badge)return;
      r.badge.style.left=(w.x+w.w)/root.Widgets.U*100+'%';
      // At the top edge there is no space above the card. Use its lower edge.
      const below=w.y/root.Widgets.heightOf(layout)*canvas.clientHeight<20;
      r.badge.style.top=(below?w.y+w.h:w.y)/root.Widgets.heightOf(layout)*100+'%';
      r.badge.style.transform=below?'translate(-100%, 2px)':'translate(-100%, calc(-100% - 2px))';
    };
    const geometry=(r,w,force=false)=>{
      const size=force||r.width!==w.w||r.height!==w.h;
      r.el.style.left=w.x/root.Widgets.U*100+'%';r.el.style.top=w.y/root.Widgets.heightOf(layout)*100+'%';
      if(size){
        r.el.style.width=w.w/root.Widgets.U*100+'%';r.el.style.height=w.h/root.Widgets.heightOf(layout)*100+'%';
        if(layout.kind!=='row'){
          r.el.style.borderRadius=root.Frame.corner(w,layout,root.Widgets.U);
          const stripe=root.Frame.laneStripe(w,layout,root.Widgets.laneBackgroundOf(w,layout),root.Widgets.U);
          r.el.style.setProperty('--lane-size',stripe.size||'0px');
        }
        // Preserve font bindings and presentation variables installed by fit.
        r.width=w.w;r.height=w.h;
      }
      labelGeometry(r,w);return size;
    };
    const decorate=(r,w,selected)=>{
      const single=selected.length===1&&selected[0]===w;
      r.el.classList.toggle('sel',selected.includes(w));
      r.el.classList.toggle('tiny',single&&(w.w<60||w.h<60));
      if(r.single!==single){
        r.el.querySelectorAll(':scope > .h').forEach(n=>n.remove());
        if(single)r.el.insertAdjacentHTML('beforeend',['nw','ne','sw','se'].map(c=>`<i class="h ${c}" data-h="${c}"></i>`).join(''));
        r.single=single;
      }
    };
    return {
      sync(selected,changed){
        // Layout defaults affect every widget. Pictures stay in their existing
        // background element and do not invalidate widget content.
        const key=JSON.stringify(Object.fromEntries(Object.entries(layout).filter(([k])=>!['widgets','guides','name','note','id','bgImage','bgFit','bgBlur','bgBrightness','bgSaturation'].includes(k))));
        const all=key!==layoutKey;layoutKey=key;
        const wanted=new Set(layout.widgets),fitting=[],dirty=changed?new Set(changed):null;
        for(const [w,r]of records)if(!wanted.has(w)){r.el.remove();r.badge?.remove();records.delete(w);}
        let before=canvas.querySelector(':scope > .lw');
        layout.widgets.forEach((w,i)=>{
          let r=records.get(w);const sig=r&&dirty&&!dirty.has(w)&&!all?r.signature:signature(w);
          if(!r||r.signature!==sig||all){
            const t=canvas.ownerDocument.createElement('template');t.innerHTML=html(w);const el=t.content.firstElementChild;
            if(r){if(before===r.el)before=el;r.el.replaceWith(el);r.badge?.remove();}
            const badge=el.querySelector(':scope > .lw-lane');
            if(badge)canvas.appendChild(badge);
            r={el,badge,signature:sig,width:w.w,height:w.h};records.set(w,r);labelGeometry(r,w);fitting.push(el);
          }else if(geometry(r,w))fitting.push(r.el);
          r.el.dataset.i=String(i);decorate(r,w,selected);
          if(r.el!==before)canvas.insertBefore(r.el,before);
          before=r.el.nextElementSibling;while(before&&!before.classList.contains('lw'))before=before.nextElementSibling;
        });
        if(fitting.length)fit(fitting);
      },
      geometry(widgets,selected){
        const fitting=[];
        for(const w of widgets){const r=records.get(w);if(!r)continue;if(geometry(r,w))fitting.push(r.el);decorate(r,w,selected);}
        if(fitting.length)fit(fitting);
      }
    };
  }
  const api={latest,create,signature};root.EditorCanvas=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
