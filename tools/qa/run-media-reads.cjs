'use strict';
const backend=process.argv[2]||'json';if(!['json','sqlite'].includes(backend))throw Error('Choose json or sqlite.');
process.env.SF_MEDIA_QA_BACKEND=backend;
require('./qualified-ui.cjs')('media-reads-electron.cjs',require('node:path').resolve(__dirname,'../../../outputs/media-read-review',backend),120000);
