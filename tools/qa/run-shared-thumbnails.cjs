'use strict';
require('./qualified-ui.cjs')('shared-thumbnails-electron.cjs',require('node:path').resolve(__dirname,'../../../outputs/shared-thumbnails/'+(process.env.SF_THUMBNAIL_QA_SQLITE==='1'?'ui-sqlite':'ui')),150000);
