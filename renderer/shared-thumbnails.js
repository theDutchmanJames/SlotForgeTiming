'use strict';
if(window.api.onThumbnailJob){
 const thumbnailWorker=new Worker('shared-thumbnail-worker.js');
 const pending=new Set();let failed=false;
 thumbnailWorker.onmessage=({data})=>{pending.delete(data.id);window.api.thumbnailResult(data.id,data.result);};
 thumbnailWorker.onerror=()=>{failed=true;for(const id of pending)window.api.thumbnailResult(id,null);pending.clear();};
 window.api.onThumbnailJob(job=>{if(failed)return window.api.thumbnailResult(job.id,null);pending.add(job.id);thumbnailWorker.postMessage(job);});
 window.api.thumbnailReady();
}
