'use strict';
// Serialise reviewed imports/restores and restrict destructive bulk actions to the main window.
module.exports = function createBulkAccess({ipcMain,getMain,isRacing}) {
  let busy=false;
  const idle=()=>{if(isRacing())throw Error('Finish the race and finalise its results before importing or restoring data.');};
  function handle(name,fn) {
    const mutation=['transfer:open','transfer:apply','backup:open','backup:restore'].includes(name);
    ipcMain.handle(name,async(event,...args)=>{
      const win=getMain();
      if(!win || win.isDestroyed() || event.sender!==win.webContents || event.senderFrame!==undefined && event.senderFrame!==win.webContents.mainFrame)throw Error('Import and backup are managed from the main app window.');
      if(mutation){idle();if(busy)throw Error('Another import or restore is in progress.');busy=true;}
      try{return await fn(event,...args);}finally{if(mutation)busy=false;}
    });
  }
  return {handle,idle};
};
