// Production leaderboard rendering, synthetic races only.
const host=document.getElementById('revision-canvas'),findings=[],checks=[];
const inside=(a,b)=>a.left>=b.left-1&&a.right<=b.right+1&&a.top>=b.top-1&&a.bottom<=b.bottom+1;
const draw=(kind,count,width,height,x=0,y=0,options={})=>{
 const design={...Rows.defaultDesign(),id:'qa-row',header:true};
 if(kind==='embedded'){
  design.ratioH=120;
  design.widgets=[{...Widgets.newWidget('name',0,5,5),w:260,h:110,showTitle:false},
   {...Widgets.newWidget('fuel',0,275,5),w:340,h:110,showTitle:false,opt:{barStyle:'digital',mode:'both',valuePlacement:'overlay'}},
   {...Widgets.newWidget('lastlap',0,625,5),w:365,h:110,showTitle:false,opt:{columns:2,lapsPerColumn:2,columnGap:20,latestLap:'row'}}];
 }
 const w={...Widgets.newWidget('leaderboard',null,0,0),w:width,h:height,opt:{...(kind==='classic'?{}:{design:design.id}),to:count,...options},appearance:{source:'theme',accent:'none'}};
 const layout={ratioW:14,ratioH:10},state=WidgetPreview.state(w,{layout,rowDesigns:[design]}),out=Timing.content(w,state),n=WidgetView.mount(host,w,layout);
 n.val.innerHTML=out.html;Object.assign(n.el.style,{left:x+'px',top:y+'px',width:width+'px',height:height+'px'});
 const before=JSON.stringify({w,design,cars:state.eng.cars}),text=n.val.textContent;WidgetView.fit(n,out);
 if(text!==n.val.textContent||before!==JSON.stringify({w,design,cars:state.eng.cars}))throw Error('Fitting changed leaderboard content, design or race state');
 n.out=out;
 return n;
};
const inspect=(n)=>{
 const box=n.el.getBoundingClientRect(),title=n.tit?.getBoundingClientRect(),content=n.val.firstElementChild?.getBoundingClientRect();
 const clipped=!Frame.textFits(n.val,n.val)||![...n.val.querySelectorAll('.lb tr,.rrow')].every(r=>inside(r.getBoundingClientRect(),box));
 const crowded=[...n.val.querySelectorAll('.rcell')].filter(c=>c.dataset.fitStatus==='too-small').map(c=>c.dataset.wvType);
 if(n.el.dataset.fitStatus!=='fits'||title&&content.top<title.bottom||clipped||crowded.length)throw Error('Leaderboard bounds '+JSON.stringify({w:n.w,clipped,crowded,status:n.el.dataset.fitStatus,title,content}));
};
for(const kind of ['classic','design','embedded'])for(const count of [4,8])for(const [width,height]of [[700,400],[420,300],[300,300]]){
 const n=draw(kind,count,width,height),box=n.el.getBoundingClientRect(),rows=n.val.querySelectorAll(kind==='classic'?'.lb tr':'.rrow:not(.rrow-head)'),cells=[...n.val.querySelectorAll('.rcell')];
 if(rows.length!==count)throw Error('Leaderboard row count changed');
 const clipped=!Frame.textFits(n.val,n.el)||[...rows].some(r=>!inside(r.getBoundingClientRect(),box));
 const crowded=cells.filter(c=>c.dataset.fitStatus==='too-small').map(c=>c.dataset.wvType);
 const result={kind,count,width,height,clipped,crowded};checks.push(result);inspect(n);n.el.remove();
}
for(const fill of ['off','rows','gaps'])for(const gaps of [0,100])for(const scale of [50,100]){
 const n=draw('design',4,420,300,0,0,{fill,gaps,scale});inspect(n);checks.push({fill,gaps,scale});n.el.remove();
}
for(const kind of ['classic','design']){
 const n=draw(kind,4,700,400),before=n.val.textContent;
 for(const [width,height]of [[80,35],[300,300],[700,400]]){
  Object.assign(n.el.style,{width:width+'px',height:height+'px'});WidgetView.fit(n,n.out);
  if(width>80)inspect(n);
  if(n.val.textContent!==before)throw Error('Resize changed leaderboard values or ordering');
 }
 checks.push({kind,resizeRecovery:true});n.el.remove();
}
{
 const design={...Rows.defaultDesign(),name:'Leaderboard sizing QA',header:true,headerH:35,fonts:{value:'mono'}};
 const saved=await api.add('rowdesigns',design),reopened=(await api.list('rowdesigns')).find(d=>d.id===saved.id);
 for(const key of Object.keys(design))if(JSON.stringify(reopened[key])!==JSON.stringify(design[key]))throw Error('Saved row design changed: '+key);
 const w={...Widgets.newWidget('leaderboard',null,0,0),opt:{design:saved.id,fill:'gaps',gaps:75,scale:80,orderBy:'best',orderDir:'best'}};
 const savedLayout=await api.add('layouts',{name:'Leaderboard save QA',ratioW:16,ratioH:9,widgets:[w]}),reopenedLayout=(await api.list('layouts')).find(l=>l.id===savedLayout.id);
 if(JSON.stringify(reopenedLayout.widgets)!==JSON.stringify([w]))throw Error('Leaderboard settings changed after reopen');
 const S=WidgetPreview.state(w,{rowDesigns:[reopened]}),html=Timing.content(reopenedLayout.widgets[0],S).html;
 if(!html.includes('rrows')||!html.includes('data-fill="gaps"'))throw Error('Saved row design did not render');
 checks.push({saveReopen:true});
}
window.leaderboardReviewGallery=()=>{host.innerHTML='';for(const args of [['classic',4,660,300,0,0],['design',8,660,400,700,0],['embedded',4,660,400,0,340],['design',4,300,300,700,440],['classic',4,300,300,1040,440]])inspect(draw(...args));};
leaderboardReviewGallery();return {checks,findings};
