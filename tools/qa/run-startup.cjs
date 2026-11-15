'use strict';
const path=require('node:path'),run=require('./qualified-ui.cjs');
for(const mode of ['normal','slow-render','boot-failure','close','load-failure','large-json','large-sqlite','early-close','storage-failure']){process.env.SF_STARTUP_QA_MODE=mode;run('startup-electron.cjs',path.resolve(__dirname,'../../../outputs/startup-feedback',mode),75000,{windowsHide:false});}
