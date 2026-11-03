'use strict';
const Compose=require('./renderer/widgetcompose');
// Follow the same explicit references consumed by Widgets.resolveOpt, Timing
// and ChartWidgets. Inline pictures/compositions stay in their owning document.
function read(source,layouts){
 const ids={rowdesigns:new Set(),chartdesigns:new Set(),imagesets:new Set(),teams:new Set()},rows=[];
 const add=(entity,id)=>{if(typeof id==='string'&&id)ids[entity].add(id);};
 function widget(w,depth=0){
  if(depth>32)throw Error('Widget composition nesting is too deep.');
  if(!w||typeof w!=='object')return;
  const o=w.opt||{};add('imagesets',o.imageSet);
  if(w.type==='leaderboard')add('rowdesigns',o.design);
  if(w.type==='racechart')add('chartdesigns',o.chartDesign);
  if(['teamname','teampicture'].includes(w.type))add('teams',o.team);
  if(['textlane','textrace'].includes(w.type)&&o.composition){
   const visit=n=>{if(!n)return;if(n.kind==='component')widget({type:n.component,opt:n.options},depth+1);for(const c of n.children||[])visit(c);};
   visit(Compose.clean(o.composition).root);
  }
 }
 for(const layout of layouts||[])for(const w of layout.widgets||[])widget(w);
 // A set iterator also visits newly discovered row references and terminates on
 // repeated/deleted IDs. Normal row editors disallow nested leaderboards.
 for(const id of ids.rowdesigns){const row=source.get('rowdesigns',id);if(row){rows.push(row);for(const w of row.widgets||[])widget(w);}}
 const selected=entity=>[...ids[entity]].map(id=>source.get(entity,id)).filter(Boolean);
 return {rowdesigns:rows,chartdesigns:selected('chartdesigns'),imagesets:selected('imagesets'),teamIds:[...ids.teams],chartIds:[...ids.chartdesigns]};
}
function charts(source,ids){if(!Array.isArray(ids)||ids.length>4096||ids.some(id=>typeof id!=='string'||!id))throw Error('Invalid chart selection.');return [...new Set(ids)].map(id=>source.get('chartdesigns',id)).filter(Boolean);}
module.exports={read,charts};
