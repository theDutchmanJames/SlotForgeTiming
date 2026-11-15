'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),fs=require('node:fs'),path=require('node:path');
function fixture(load=()=>Promise.resolve()){
 let win,quits=0;
 class Window extends EventEmitter{
  constructor(options){super();win=this;this.options=options;this.webContents=new EventEmitter();this.webContents.setWindowOpenHandler=fn=>this.open=fn;this.shows=0;}
  loadFile(file){this.file=file;return load();}show(){this.shows++;}isVisible(){return this.shows>0;}setTitle(title){this.title=title;}isDestroyed(){return !!this.destroyed;}destroy(){this.destroyed=true;this.emit('closed');}
 }
 const feedback=require('../startup-feedback').create({BrowserWindow:Window,quit:()=>quits++});
 return {win,feedback,quits:()=>quits};
}
test('startup feedback is sandboxed, visible before readiness resolves, and safe to close',async()=>{
 const {win,feedback,quits}=fixture();
 assert.equal(win.options.webPreferences.preload,undefined);assert.equal(win.options.webPreferences.nodeIntegration,false);assert.equal(win.options.webPreferences.sandbox,true);assert.deepEqual(win.open(),{action:'deny'});
 let prevented=false;win.webContents.emit('will-navigate',{preventDefault(){prevented=true;}});assert.ok(prevented);
 assert.equal(win.shows,0);win.emit('ready-to-show');assert.equal(await feedback.ready,true);assert.equal(win.shows,1);
 win.emit('close',{preventDefault(){}});assert.equal(quits(),1);assert.equal(win.destroyed,undefined);feedback.dispose();feedback.dispose();assert.ok(win.destroyed);
 const html=fs.readFileSync(win.file,'utf8'),css=fs.readFileSync(path.join(path.dirname(win.file),'startup.css'),'utf8');assert.doesNotMatch(html,/<script\b/i);assert.match(html,/default-src 'none'/);assert.match(css,/prefers-reduced-motion/);assert.match(css,/prefers-color-scheme/);
});
test('feedback disposal or failed load settles the wait without reopening it',async()=>{
 const first=fixture();first.feedback.dispose();assert.equal(await first.feedback.ready,false);first.win.emit('ready-to-show');assert.equal(first.win.shows,0);
 const second=fixture(()=>Promise.reject(Error('missing page')));assert.equal(await second.feedback.ready,false);second.feedback.dispose();
});
test('a Windows launcher hiding the first show request gets a visible second show',async()=>{
 const {win,feedback}=fixture();win.isVisible=()=>win.shows>1;win.emit('ready-to-show');
 assert.equal(await feedback.ready,true);assert.equal(win.shows,2);feedback.dispose();
});
test('a platform that never paints feedback cannot block startup indefinitely',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const {feedback,win}=fixture();t.mock.timers.tick(5000);assert.equal(await feedback.ready,false);assert.equal(win.shows,0);feedback.dispose();
});
function screen(){const win=new EventEmitter();win.webContents=new EventEmitter();win.webContents.mainFrame={};return {win,ipcMain:new EventEmitter(),app:new EventEmitter()};}
test('portable extraction uses a small, valid 24-bit branded bitmap',()=>{
 const root=path.join(__dirname,'..'),config=require('../package.json').build.portable;
 const bytes=fs.readFileSync(path.join(root,config.splashImage));
 assert.equal(bytes.toString('ascii',0,2),'BM');assert.equal(bytes.readUInt32LE(2),bytes.length);
 assert.equal(bytes.readUInt32LE(10),54);assert.equal(bytes.readUInt16LE(28),24);assert.equal(bytes.readUInt32LE(30),0);
 assert.equal(bytes.readInt32LE(18),460);assert.equal(bytes.readInt32LE(22),270);assert.equal(bytes.length,54+460*270*3);
 let red=0;for(let i=54;i<bytes.length;i+=3)if(bytes[i+2]>180&&bytes[i+1]<100&&bytes[i]<110)red++;
 assert.ok(red>1000,'brand red is preserved in the Windows BGR bitmap');
});
test('main handoff waits for its own first render and removes listeners',async()=>{
 const context=screen(),wait=require('../startup-screen').waitForScreen(context);let done=false;wait.ready.then(()=>done=true);
 context.ipcMain.emit('startup:ready',{sender:{},senderFrame:{}});context.ipcMain.emit('startup:ready',{sender:context.win.webContents,senderFrame:{}});await Promise.resolve();assert.equal(done,false);
 context.ipcMain.emit('startup:ready',{sender:context.win.webContents,senderFrame:context.win.webContents.mainFrame});await wait.ready;assert.equal(done,true);assert.equal(context.ipcMain.listenerCount('startup:ready'),0);assert.equal(context.app.listenerCount('before-quit'),0);
});
test('quitting or cancelling while the first screen loads cannot deadlock shutdown',async()=>{
 for(const event of ['quit','closed','cancel']){const c=screen(),w=require('../startup-screen').waitForScreen(c);if(event==='quit')c.app.emit('before-quit');else if(event==='closed')c.win.emit('closed');else w.cancel();await w.ready;assert.equal(c.ipcMain.listenerCount('startup:ready'),0);}
});
test('renderer crash and missing first-render signal produce an opening error',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const c=screen(),w=require('../startup-screen').waitForScreen(c),gone=assert.rejects(w.ready,/stopped/);c.win.webContents.emit('render-process-gone');await gone;
 const other=screen(),timeout=require('../startup-screen').waitForScreen({...other,timeout:10}),failed=assert.rejects(timeout.ready,/too long/);t.mock.timers.tick(10);await failed;assert.equal(other.ipcMain.listenerCount('startup:ready'),0);
});
test('a broken preload fails immediately instead of leaving the loading window waiting',async()=>{
 const c=screen(),w=require('../startup-screen').waitForScreen(c),failed=assert.rejects(w.ready,/could not connect.*QA preload/);
 c.win.webContents.emit('preload-error',{},'preload.js',Error('QA preload'));await failed;
 assert.equal(c.ipcMain.listenerCount('startup:ready'),0);assert.equal(c.win.webContents.listenerCount('preload-error'),0);
});
