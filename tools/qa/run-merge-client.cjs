'use strict';
const backend=process.argv[2]||'json';if(!['json','sqlite'].includes(backend))throw Error('Choose json or sqlite.');
process.env.SF_SHARED_ENGINE_BACKEND=backend;process.env.SF_MERGE_CLIENT_QA='1';
require('./qualified-ui.cjs')('shared-engine-electron.cjs',require('node:path').resolve(__dirname,'../../../outputs/merge-client-ui',backend),120000);
