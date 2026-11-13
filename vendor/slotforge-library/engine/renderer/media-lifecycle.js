'use strict';
(()=>{
 const worker=new Worker('media-thumbnail-worker.js');
 window.slotforge.onThumbnail(job=>worker.postMessage(job));
 worker.onmessage=({data})=>window.slotforge.thumbnailResult(data.id,data.result);
 let sharedWorker,sharedRestarts=0;
 function startSharedWorker(){
  sharedWorker?.terminate();sharedWorker=new Worker('shared-thumbnail-worker.js');const currentWorker=sharedWorker;
  sharedWorker.onmessage=({data})=>window.slotforge.sharedThumbnailResult(data.id,data.result);
  const failed=()=>{if(sharedWorker!==currentWorker)return;window.slotforge.sharedThumbnailFailed();sharedWorker.terminate();sharedWorker=null;if(sharedRestarts++<1)startSharedWorker();};
  sharedWorker.onerror=failed;sharedWorker.onmessageerror=failed;
  window.slotforge.sharedThumbnailReady();
 }
 window.slotforge.onSharedThumbnail(job=>{if(!sharedWorker)startSharedWorker();sharedWorker.postMessage(job);});
 startSharedWorker();
 // One lease covers the application dialogs, including nested viewer/editor
 // transitions. Release only when the final dialog closes.
 let active=false;const sync=()=>{const next=!!document.querySelector('dialog[open]');if(next!==active){active=next;window.slotforge.mediaLease(next);}};
 new MutationObserver(sync).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
})();
