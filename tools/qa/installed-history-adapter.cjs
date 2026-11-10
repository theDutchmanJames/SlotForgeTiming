'use strict';
const assert=require('node:assert/strict');
function isolateBootstrap(code){
 const protocol='app.setAsDefaultProtocolClient=()=>false;app.removeAsDefaultProtocolClient=()=>false;';
 if(!code.includes(protocol)){
  assert(code.includes('app.disableHardwareAcceleration();'),'Unknown packaged bootstrap startup');
  code=code.replace('app.disableHardwareAcceleration();',protocol+'app.disableHardwareAcceleration();');
 }
 const window='mainWindow=win;win.setSize(1280,1000);',paint='win.setOpacity(0);BrowserWindow.prototype.showInactive.call(win);';
 assert(code.includes(window),'Unknown packaged bootstrap window');
 if(!code.includes(window+paint))code=code.replace(window,window+paint);
 return code;
}
function strictVerification(code){
 // Both published versions are supported. Timing qualification never permits
 // the exploratory candidate exception, even if --candidate was supplied.
 const candidate=/^\s*else if\((?:allowCandidate&&)?role==='timing'&&file==='sqlite-paddock\.js'\).*;\r?\n/m;
 assert(candidate.test(code),'Published package comparison changed; review it before running');
 code=code.replace(candidate,'\n');
 assert(!code.includes("file==='sqlite-paddock.js'"),'Candidate source exception remained');
 return code;
}
module.exports={isolateBootstrap,strictVerification};
