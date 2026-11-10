'use strict';
const backend=process.argv[2]||'json';if(!['json','sqlite'].includes(backend))throw Error('Choose json or sqlite.');process.env.SF_RESULTS_BACKEND=backend;
require('./qualified-ui.cjs')('results-repair-electron.cjs',require('node:path').resolve(__dirname,'../../../outputs/results-repair',backend),120000);
