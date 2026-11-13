const widgets=[{...Widgets.newWidget('lastlap',0,20,20),w:340,h:600,opt:{columns:2,lapsPerColumn:15},bgColor:'#eef0f2',textColor:'#202830',fonts:{value:'mono'},radius:10},
 {...Widgets.newWidget('fuel',1,390,20),w:350,h:90,opt:{barStyle:'digital',mode:'both'}},
 {...Widgets.newWidget('aiodriver',0,390,140),w:350,h:350,opt:{avatar:true,car:true}}];
const original={bgColor:widgets[0].bgColor,textColor:widgets[0].textColor,fonts:widgets[0].fonts,radius:widgets[0].radius};
state.tab='custom';state.customSub='layouts';state.sideOpen=new Set(['title','text','opts']);
state.editing={id:null,draft:{name:'Widget revisions QA only',ratioW:16,ratioH:11,widgets,guides:{v:[],h:[]}},sel:[widgets[0]],snap:true,dirty:true,drivers:[],cars:[],teams:[],customWidgets:[],imageSets:[],rowDesigns:[],chartDesigns:[]};await render();
const change=(selector,value)=>{const e=document.querySelector(selector);if(!e)throw Error('Missing control '+selector);if(e.type==='checkbox')e.checked=value;else e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));};
change('#side [data-ws=typography][data-key=titleSize]',6);
change('#side [data-ws=typography][data-key=mode]','manual');
change('#side [data-ws=typography][data-key=valueSize]',6);
change('#side [data-opt=rowGap]',7);change('#side [data-opt=columnGap]',60);change('#side [data-opt=latestLap]','spotlight');change('#side [data-opt=columnDivider]',false);
state.editing.sel=[widgets[1]];renderEditor();change('#side [data-opt=valuePlacement]','above');
state.editing.sel=[widgets[2]];renderEditor();change('#side [data-ws=typography][data-key=mode]','manual');
for(const key of ['valueSize','supportSize','labelSize'])change('#side [data-ws=typography][data-key='+key+']',6);
await editorSave();const saved=(await api.list('layouts')).find(x=>x.name==='Widget revisions QA only');
if(!saved)throw Error('Disposable layout was not saved');
const first=saved.widgets[0];for(const [k,v]of Object.entries(original))if(JSON.stringify(first[k])!==JSON.stringify(v))throw Error('Existing appearance changed: '+k);
if(first.typography.titleSize!==6||first.typography.valueSize!==6||first.opt.rowGap!==7||first.opt.columnGap!==60||first.opt.latestLap!=='spotlight'||first.opt.columnDivider!==false||saved.widgets[1].opt.valuePlacement!=='above')throw Error('New settings did not survive save');
state.editing={...state.editing,id:saved.id,draft:structuredClone(saved),sel:[]};renderEditor();await document.fonts.ready;fitEditorWidgets();
window.revisionSaved=saved;
return {saved:true,appearancePreserved:true};
