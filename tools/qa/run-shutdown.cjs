'use strict';
const path=require('node:path'),run=require('./qualified-ui.cjs');
for(const mode of ['sqlite','json']){process.env.SF_SHUTDOWN_QA_MODE=mode;run('shutdown-electron.cjs',path.resolve(__dirname,'../../../outputs/paddock-followup/shutdown-ui',mode),40000);}
