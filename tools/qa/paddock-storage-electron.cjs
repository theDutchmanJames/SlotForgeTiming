const fs=require('node:fs'),path=require('node:path'),{app}=require('electron');
const out=path.resolve(__dirname,'../../../outputs/sqlite-conversion/paddock-ui');fs.mkdirSync(out,{recursive:true});
require('./file-diagnostics.cjs')(path.join(out,'diagnostics.log'),()=>app.exit(1));
require('./paddock-performance-electron.cjs');
