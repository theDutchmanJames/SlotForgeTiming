'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const outputs=path.resolve(__dirname,'../../../outputs');
const candidate=JSON.parse(fs.readFileSync(path.join(outputs,'timing-2.2.0-candidate-latest.json')));
assert.equal(path.dirname(candidate.parent),outputs);assert(path.basename(candidate.parent).startsWith('timing-2.2.0-candidate-'));
const out=fs.mkdtempSync(path.join(candidate.parent,'smoke-'));
process.env.SF_TIMING_CANDIDATE_DIR=candidate.parent;process.env.SF_TIMING_CANDIDATE_SMOKE=out;
require('./qualified-ui.cjs')('timing-candidate-electron.cjs',out,90000);
console.log('Candidate archive smoke: '+out);
