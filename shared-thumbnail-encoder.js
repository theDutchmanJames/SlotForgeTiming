'use strict';
// Send decoding to a browser Worker; neither the UI thread nor the SQLite worker resizes photos.
module.exports=function({ipcMain,getMain}){
 const pending=new Map();let sequence=0,ready=false,observed;
 const reset=()=>{ready=false;for(const job of pending.values()){clearTimeout(job.timer);job.reject(Error('Photo preview worker was interrupted.'));}pending.clear();};
 const owner=e=>{const win=getMain();return win&&!win.isDestroyed()&&e.sender===win.webContents&&e.senderFrame===win.webContents.mainFrame;};
 ipcMain.on('library:thumbnail-ready',e=>{if(!owner(e))return;if(observed!==e.sender){observed=e.sender;observed.on('did-start-navigation',(_event,_url,inPlace,main)=>{if(main&&!inPlace)reset();});observed.on('render-process-gone',reset);observed.on('destroyed',reset);}ready=true;});
 ipcMain.on('library:thumbnail-result',(e,id,data)=>{if(!owner(e))return;const job=pending.get(id);if(!job)return;pending.delete(id);clearTimeout(job.timer);typeof data==='string'?job.resolve(data):job.reject(Error('Photo preview could not be generated.'));});
 return source=>new Promise((resolve,reject)=>{
  const win=getMain();if(!ready||!win||win.isDestroyed())return reject(Error('Photo preview worker is not ready.'));
  const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('Photo preview generation timed out.'));},20000);timer.unref?.();
  pending.set(id,{resolve,reject,timer});win.webContents.send('library:thumbnail-job',{id,source});
 });
};
