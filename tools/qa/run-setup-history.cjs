'use strict';
const backend=process.argv[2]||'json';if(!['json','sqlite'].includes(backend))throw Error('Choose json or sqlite.');process.env.SF_SETUP_HISTORY_BACKEND=backend;
require('./qualified-ui.cjs')('setup-history-electron.cjs',require('node:path').resolve(__dirname,'../../../outputs/setup-history-review',backend),120000);
