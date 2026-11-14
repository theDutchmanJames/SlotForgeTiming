'use strict';
const backend=process.argv[2]||'json';if(!['json','sqlite'].includes(backend))throw Error('Choose json or sqlite.');process.env.SF_SHARED_ENGINE_BACKEND=backend;
require('./qualified-ui.cjs')('wishlist-electron.cjs',require('node:path').resolve(__dirname,'../../../outputs/wishlist-ui',backend),120000);
