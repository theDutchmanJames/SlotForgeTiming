'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),fs=require('node:fs'),path=require('node:path');
test('opening feedback has no preload or Node access, blocks navigation, and closes only after preparation',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let window,quits=0;
 class Window extends EventEmitter{constructor(options){super();window=this;this.options=options;this.webContents=new EventEmitter();this.webContents.setWindowOpenHandler=fn=>this.open=fn;this.destroyed=false;}loadFile(file){this.file=file;return Promise.resolve();}show(){this.shown=true;}setTitle(title){this.title=title;}isDestroyed(){return this.destroyed;}destroy(){this.destroyed=true;}}
 const feedback=require('../startup-feedback').create({BrowserWindow:Window,quit:()=>quits++});
 assert.equal(window.options.webPreferences.preload,undefined);assert.equal(window.options.webPreferences.nodeIntegration,false);assert.equal(window.options.webPreferences.sandbox,true);assert.deepEqual(window.open(),{action:'deny'});
 let prevented=false;window.webContents.emit('will-navigate',{preventDefault(){prevented=true;}});assert.ok(prevented);
 window.emit('ready-to-show');assert.equal(window.shown,undefined);t.mock.timers.tick(250);assert.ok(window.shown);prevented=false;window.emit('close',{preventDefault(){prevented=true;}});assert.ok(prevented);assert.equal(quits,1);assert.equal(window.destroyed,false);
 feedback.dispose();feedback.dispose();assert.ok(window.destroyed);
 const html=fs.readFileSync(window.file,'utf8'),css=fs.readFileSync(path.join(path.dirname(window.file),'startup.css'),'utf8');assert.doesNotMatch(html,/<script\b/i);assert.match(html,/default-src 'none'/);assert.match(css,/prefers-reduced-motion/);assert.match(css,/prefers-color-scheme/);
});
test('fast startup never flashes; elapsed time alone cannot show unpainted feedback',t=>{
 t.mock.timers.enable({apis:['setTimeout']});let win;
 class Window extends EventEmitter{constructor(){super();win=this;this.webContents=new EventEmitter();this.webContents.setWindowOpenHandler=()=>{};this.shows=0;}loadFile(){return Promise.resolve();}show(){this.shows++;}isDestroyed(){return !!this.destroyed;}destroy(){this.destroyed=true;}}
 const first=require('../startup-feedback').create({BrowserWindow:Window,quit(){}});win.emit('ready-to-show');first.dispose();t.mock.timers.tick(300);assert.equal(win.shows,0);
 const second=require('../startup-feedback').create({BrowserWindow:Window,quit(){}});t.mock.timers.tick(300);assert.equal(win.shows,0);win.emit('ready-to-show');assert.equal(win.shows,1);second.dispose();
});
