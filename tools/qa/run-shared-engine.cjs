'use strict';
const backend=process.argv[2]||'json';if(!['json','sqlite'].includes(backend))throw Error('Choose json or sqlite.');process.env.SF_SHARED_ENGINE_BACKEND=backend;
require('./qualified-ui.cjs')('shared-engine-electron.cjs',require('node:path').resolve(__dirname,'../../../outputs/shared-engine-ui',backend),120000);
