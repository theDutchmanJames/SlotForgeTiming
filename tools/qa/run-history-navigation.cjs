'use strict';
const backend=process.argv[2]||'json';
if(!['json','sqlite'].includes(backend))throw Error('Choose json or sqlite.');
process.env.SF_HISTORY_NAV_BACKEND=backend;
require('./qualified-ui.cjs')('history-navigation-electron.cjs',require('node:path').resolve(__dirname,'../../../outputs/history-navigation',backend),120000);
