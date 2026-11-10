'use strict';
const path=require('node:path');
// Script-free, no preload and no application IPC. It exists only while the
// asynchronous storage/bootstrap work prepares the real application window.
function create({BrowserWindow,quit}){
 const win=new BrowserWindow({width:460,height:270,useContentSize:true,resizable:false,maximizable:false,minimizable:false,show:false,autoHideMenuBar:true,title:'Opening SlotForge Timing',icon:path.join(__dirname,'build','icon.png'),backgroundColor:'#171c23',webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
 let disposed=false,ready=false,elapsed=false;
 const show=()=>{if(ready&&elapsed&&!disposed&&!win.isDestroyed())win.show();};
 const timer=setTimeout(()=>{elapsed=true;show();},250);
 win.on('close',event=>{if(!disposed){event.preventDefault();win.setTitle('Finishing database preparation…');quit();}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',event=>event.preventDefault());
 win.once('ready-to-show',()=>{ready=true;show();});
 // A feedback-page failure must not turn a successful database open into an
 // unhandled rejection. The main window remains the authority for startup.
 win.loadFile(path.join(__dirname,'renderer','startup.html')).catch(()=>{});
 return {dispose(){if(disposed)return;disposed=true;clearTimeout(timer);if(!win.isDestroyed())win.destroy();}};
}
module.exports={create};
