'use strict';
// Wait for the first application render, not just index.html's load event.
// Only this window's main frame can complete the handoff.
function waitForScreen({win,ipcMain,app,timeout=180000}){
 let finish;
 const ready=new Promise((resolve,reject)=>{
  let settled=false;
  const clean=()=>{clearTimeout(timer);ipcMain.removeListener('startup:ready',onReady);app.removeListener('before-quit',onQuit);win.removeListener('closed',onQuit);win.webContents.removeListener('render-process-gone',onGone);win.webContents.removeListener('preload-error',onPreloadError);};
  finish=error=>{if(settled)return;settled=true;clean();error?reject(error):resolve();};
  const onReady=event=>{if(event.sender===win.webContents&&event.senderFrame===win.webContents.mainFrame)finish();};
  const onQuit=()=>finish();
  const onGone=()=>finish(Error('The application screen stopped before it could open.'));
  const onPreloadError=(_event,_file,error)=>finish(Error('The application screen could not connect to Timing. '+String(error?.message||error)));
  const timer=setTimeout(()=>finish(Error('The first screen is taking too long to open. Close Timing and try again.')),timeout);
  ipcMain.on('startup:ready',onReady);app.once('before-quit',onQuit);win.once('closed',onQuit);win.webContents.once('render-process-gone',onGone);win.webContents.once('preload-error',onPreloadError);
 });
 return {ready,cancel:()=>finish()};
}
module.exports={waitForScreen};
