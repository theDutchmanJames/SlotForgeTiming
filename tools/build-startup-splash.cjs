'use strict';
// Regenerate the committed NSIS bitmap from the actual startup page. This is a
// build-maintenance tool only; it never loads main.js or opens an app database.
const {app,BrowserWindow,nativeTheme}=require('electron'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.tmp-test','startup-artwork');fs.mkdirSync(out,{recursive:true});
app.setPath('userData',fs.mkdtempSync(path.join(out,'profile-')));app.disableHardwareAcceleration();
require('./qa/file-diagnostics.cjs')(path.join(out,'diagnostics.log'),()=>app.exit(1));
const timer=setTimeout(()=>app.exit(2),15000);
app.whenReady().then(async()=>{
 nativeTheme.themeSource='dark';const win=new BrowserWindow({width:460,height:270,useContentSize:true,show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
 await win.loadFile(path.join(root,'renderer/startup.html'));
 await win.webContents.executeJavaScript(`document.querySelector('.status').textContent='Unpacking the portable application…';document.querySelector('.note').textContent='Timing will open automatically when it is ready.';const bar=document.querySelector('.progress');if(bar)bar.style.background='#ee414c';`);
 await win.webContents.insertCSS('.progress:before{animation:none;transform:none;width:100%}');
 await new Promise(resolve=>setTimeout(resolve,150));
 const image=await win.webContents.capturePage(),png=image.toPNG(),{width,height}=image.getSize(),data=image.toBitmap();
 // NSIS BgImage expects an uncompressed Windows bitmap; use 24-bit BGR rows.
 const stride=(width*3+3)&~3,pixels=stride*height,bmp=Buffer.alloc(54+pixels);
 bmp.write('BM');bmp.writeUInt32LE(bmp.length,2);bmp.writeUInt32LE(54,10);bmp.writeUInt32LE(40,14);bmp.writeInt32LE(width,18);bmp.writeInt32LE(height,22);bmp.writeUInt16LE(1,26);bmp.writeUInt16LE(24,28);bmp.writeUInt32LE(pixels,34);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const src=(y*width+x)*4,dst=54+(height-1-y)*stride+x*3;bmp[dst]=data[src];bmp[dst+1]=data[src+1];bmp[dst+2]=data[src+2];}
 fs.writeFileSync(path.join(root,'build/startup-splash.bmp'),bmp);fs.writeFileSync(path.join(out,'portable.png'),png);clearTimeout(timer);app.exit(0);
}).catch(error=>{console.error(error);app.exit(1);});
