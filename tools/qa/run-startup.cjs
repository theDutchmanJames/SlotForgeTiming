'use strict';
const path=require('node:path'),run=require('./qualified-ui.cjs');
for(const mode of ['normal','close','load-failure']){process.env.SF_STARTUP_QA_MODE=mode;run('startup-electron.cjs',path.resolve(__dirname,'../../../outputs/sqlite-conversion/startup-ui',mode),60000);}
